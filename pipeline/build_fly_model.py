"""Build the articulated fruit fly model used by the 3D views.

Source: the flybody fruit fly (TuragaLab/flybody, Apache-2.0), the MJCF file
flybody/fruitfly/assets/fruitfly.xml and the OBJ meshes next to it. Only the
GitHub repository files are used; nothing from the separate Figshare data.

What the script does:
  1. Parses the MJCF body tree, including default classes, joint axes and
     spring reference angles (used as the resting pose).
  2. Loads each visual mesh, places it in its body frame, and simplifies it.
  3. Adds texture coordinates made for the Connectome Lab textures: an
     azimuthal projection per compound eye, a dorsal projection on the thorax,
     a cylindrical projection along the abdomen and a planar one on each wing.
  4. Writes a glTF binary with one node per body. Each node carries its joints
     in `extras` so the browser can pose legs and wings.

Needs: pip install numpy fast_simplification pygltflib

Usage (the site ships a 90k and a 30k triangle version):
  git clone --depth 1 https://github.com/TuragaLab/flybody /tmp/flybody
  python pipeline/build_fly_model.py --flybody /tmp/flybody --out /tmp/fly-hi.glb --budget 90000
  python pipeline/build_fly_model.py --flybody /tmp/flybody --out /tmp/fly-lo.glb --budget 30000
  # meshopt compression (about 3x smaller); meshes sit on their own child nodes,
  # so the dequantising transforms never mix with the joint rotations
  npx @gltf-transform/cli@4 meshopt /tmp/fly-hi.glb web/public/models/fly-hi.glb \
      --level high --quantize-position 14 --quantize-normal 10 --quantize-texcoord 12
  (same for fly-lo)
"""
from __future__ import annotations

import argparse
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import fast_simplification
import numpy as np
import pygltflib as gl

# ---------------------------------------------------------------- math


def qmul(a, b):
    w1, x1, y1, z1 = a
    w2, x2, y2, z2 = b
    return np.array([
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    ])


def qnorm(q):
    q = np.asarray(q, float)
    return q / np.linalg.norm(q)


def qaxis(axis, ang):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    s = math.sin(ang / 2)
    return np.array([math.cos(ang / 2), *(axis * s)])


def qmat(q):
    w, x, y, z = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def vec(s, n=3, default=None):
    if s is None:
        return default
    v = [float(t) for t in s.split()]
    assert len(v) == n, s
    return np.array(v)


# ---------------------------------------------------------------- MJCF


def read_defaults(node, parent_attrs, out):
    """Collect default attributes per class, following MJCF inheritance."""
    name = node.get("class", "main")
    attrs = {k: dict(v) for k, v in parent_attrs.items()}
    for child in node:
        if child.tag == "default":
            continue
        attrs.setdefault(child.tag, {}).update(child.attrib)
    out[name] = attrs
    for child in node:
        if child.tag == "default":
            read_defaults(child, attrs, out)


def resolved(elem, cls, defaults):
    c = elem.get("class", cls)
    base = dict(defaults.get(c, {}).get(elem.tag, {}))
    base.update(elem.attrib)
    return base


class Body:
    def __init__(self, name, pos, quat, parent):
        self.name = name
        self.pos = pos
        self.quat = quat  # body frame, without joints
        self.parent = parent
        self.joints: list[dict] = []
        self.geoms: list[dict] = []
        self.children: list[Body] = []
        self.rest = quat  # with joints at their spring reference
        self.world_q = None
        self.world_p = None


def parse(xml_path: Path):
    root = ET.parse(xml_path).getroot()
    defaults: dict = {}
    read_defaults(root.find("default"), {}, defaults)
    mesh_scale = vec(defaults["main"].get("mesh", {}).get("scale"), 3, np.ones(3))
    meshes = {}
    for m in root.find("asset").iter("mesh"):
        meshes[m.get("name")] = m.get("file")
    bodies: list[Body] = []

    def walk(el, parent, cls):
        cls = el.get("childclass", cls)
        pos = vec(el.get("pos"), 3, np.zeros(3))
        quat = qnorm(vec(el.get("quat"), 4, np.array([1.0, 0, 0, 0])))
        b = Body(el.get("name"), pos, quat, parent)
        bodies.append(b)
        for j in el.findall("joint"):
            a = resolved(j, cls, defaults)
            b.joints.append({
                "name": a.get("name"),
                "axis": [float(t) for t in a.get("axis", "0 0 1").split()],
                "ref": float(a.get("springref", 0)),
                "range": [float(t) for t in a["range"].split()] if "range" in a else None,
            })
        for g in el.findall("geom"):
            a = resolved(g, cls, defaults)
            if a.get("type", "sphere") != "mesh" or "mesh" not in a:
                continue
            b.geoms.append({
                "name": a.get("name") or a["mesh"],
                "file": meshes[a["mesh"]],
                "material": a.get("material", "body"),
                "pos": vec(a.get("pos"), 3, np.zeros(3)),
                "quat": qnorm(vec(a.get("quat"), 4, np.array([1.0, 0, 0, 0]))),
            })
        rest = quat
        for jt in b.joints:
            rest = qmul(rest, qaxis(jt["axis"], jt["ref"]))
        b.rest = rest
        if parent is None:
            b.world_q, b.world_p = rest, pos
        else:
            b.world_q = qmul(parent.world_q, rest)
            b.world_p = parent.world_p + qmat(parent.world_q) @ pos
        if parent is not None:
            parent.children.append(b)
        for c in el.findall("body"):
            walk(c, b, cls)

    walk(root.find("worldbody").find("body"), None, "main")
    return bodies, mesh_scale


# ---------------------------------------------------------------- meshes


def load_obj(path: Path):
    """Positions and triangles of an OBJ, with duplicate corners merged."""
    verts, faces = [], []
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(t) for t in line.split()[1:4]])
            elif line.startswith("f "):
                idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    faces.append([idx[0], idx[k], idx[k + 1]])
    v = np.array(verts, np.float64)
    f = np.array(faces, np.int64)
    key = np.round(v, 6)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    f = inv.reshape(-1)[f]
    keep = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])
    return uniq.astype(np.float64), f[keep]


def simplify(v, f, target):
    if len(f) <= target:
        return v, f
    red = 1 - target / len(f)
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=red, agg=5)
    return v2.astype(np.float64), f2.astype(np.int64)


def normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return n / ln


# Share of the triangle budget per material or part. Bristles and eyes keep
# more detail because they carry the look; hidden parts get little.
WEIGHTS = {
    "red": 0.16, "black": 0.26, "body": 0.40, "lower": 0.05, "brown": 0.02,
    "ocelli": 0.01, "bristle-brown": 0.02, "membrane": 0.02,
}
SKIP = {"wing_left_brown", "wing_right_brown"}  # veins come from the wing texture
MIN_TRIS = 60


# ---------------------------------------------------------------- texture coordinates


def uv_eye(pw, side):
    """Azimuthal projection around the outward axis of one compound eye."""
    c = pw.mean(axis=0)
    d = pw - c
    out = np.array([0, side, 0.0])
    fwd = np.array([1.0, 0, 0])
    up = np.array([0, 0, 1.0])
    a = np.arctan2(d @ fwd, d @ out)
    b = np.arctan2(d @ up, d @ out)
    return np.stack([0.5 + a / 2.6 * side, 0.5 + b / 2.6], axis=1)


def uv_dorsal(pw, center, span):
    """Top down projection: u along the body, v across it."""
    d = pw - center
    return np.stack([0.5 + d[:, 0] / span[0], 0.5 + d[:, 1] / span[1]], axis=1)


def uv_cylinder(pw, a0, a1):
    """u along the abdomen axis, v around it with the dorsal midline at 0.5."""
    ax = a1 - a0
    L = np.linalg.norm(ax)
    ax /= L
    d = pw - a0
    t = d @ ax
    r = d - np.outer(t, ax)
    up = np.array([0, 0, 1.0])
    up = up - ax * (up @ ax)
    up /= np.linalg.norm(up)
    side = np.cross(ax, up)
    ang = np.arctan2(r @ side, r @ up)
    return np.stack([t / L, 0.5 + ang / (2 * math.pi)], axis=1)


def uv_wing(pl, root_local):
    """Planar projection in the wing plane; u from root (0) to tip (1)."""
    c = pl.mean(axis=0)
    d = pl - c
    _, _, vt = np.linalg.svd(d, full_matrices=False)
    e1, e2 = vt[0], vt[1]
    if (root_local - c) @ e1 > 0:
        e1 = -e1
    p1, p2 = d @ e1, d @ e2
    u = (p1 - p1.min()) / (p1.max() - p1.min())
    v = (p2 - p2.min()) / (p2.max() - p2.min())
    return np.stack([u, v], axis=1), e2


# ---------------------------------------------------------------- glTF writer


class Writer:
    def __init__(self):
        self.g = gl.GLTF2()
        self.g.asset = gl.Asset(generator="connectome-lab build_fly_model.py", copyright="Mesh: flybody (TuragaLab), Apache-2.0")
        self.blob = bytearray()
        self.g.buffers = [gl.Buffer()]
        self.materials: dict[str, int] = {}

    def view(self, arr: np.ndarray, target):
        while len(self.blob) % 4:
            self.blob.append(0)
        off = len(self.blob)
        self.blob += arr.tobytes()
        self.g.bufferViews.append(gl.BufferView(buffer=0, byteOffset=off, byteLength=arr.nbytes, target=target))
        return len(self.g.bufferViews) - 1

    def accessor(self, arr: np.ndarray, kind, ctype, target, minmax=False):
        bv = self.view(arr, target)
        acc = gl.Accessor(bufferView=bv, componentType=ctype, count=len(arr), type=kind)
        if minmax:
            acc.min = arr.min(axis=0).tolist()
            acc.max = arr.max(axis=0).tolist()
        self.g.accessors.append(acc)
        return len(self.g.accessors) - 1

    def material(self, name, rgba):
        if name not in self.materials:
            self.g.materials.append(gl.Material(
                name=name, doubleSided=name == "wing",
                alphaMode="BLEND" if name == "wing" else "OPAQUE",
                pbrMetallicRoughness=gl.PbrMetallicRoughness(baseColorFactor=list(rgba), metallicFactor=0, roughnessFactor=0.5),
            ))
            self.materials[name] = len(self.g.materials) - 1
        return self.materials[name]

    def mesh(self, name, prims):
        ps = []
        for mat, v, n, uv, f in prims:
            attrs = gl.Attributes(
                POSITION=self.accessor(v.astype(np.float32), "VEC3", gl.FLOAT, gl.ARRAY_BUFFER, True),
                NORMAL=self.accessor(n.astype(np.float32), "VEC3", gl.FLOAT, gl.ARRAY_BUFFER),
            )
            if uv is not None:
                attrs.TEXCOORD_0 = self.accessor(uv.astype(np.float32), "VEC2", gl.FLOAT, gl.ARRAY_BUFFER)
            itype = gl.UNSIGNED_SHORT if len(v) < 65536 else gl.UNSIGNED_INT
            idx = f.reshape(-1).astype(np.uint16 if itype == gl.UNSIGNED_SHORT else np.uint32)
            ps.append(gl.Primitive(attributes=attrs, indices=self.accessor(idx, "SCALAR", itype, gl.ELEMENT_ARRAY_BUFFER), material=mat))
        self.g.meshes.append(gl.Mesh(name=name, primitives=ps))
        return len(self.g.meshes) - 1

    def save(self, path: Path):
        self.g.buffers[0].byteLength = len(self.blob)
        self.g.set_binary_blob(bytes(self.blob))
        self.g.save_binary(str(path))


# Colours before textures, close to the flybody palette.
PALETTE = {
    "body": (0.62, 0.40, 0.2, 1), "thorax": (0.55, 0.38, 0.2, 1), "abdomen": (0.78, 0.6, 0.3, 1),
    "lower": (0.8, 0.66, 0.45, 1), "eye": (0.72, 0.05, 0.03, 1), "ocelli": (0.13, 0.05, 0.02, 1),
    "bristle": (0.03, 0.02, 0.015, 1), "claw": (0.2, 0.08, 0.03, 1), "wing": (0.85, 0.88, 0.9, 0.5),
}


def material_for(body: str, mat: str):
    if mat == "red":
        return "eye"
    if mat == "membrane":
        return "wing"
    if mat in ("black", "bristle-brown"):
        return "bristle"
    if mat == "brown":
        return "claw"
    if mat == "ocelli":
        return "ocelli"
    if mat == "lower":
        return "lower"
    if body == "thorax":
        return "thorax"
    if body.startswith("abdomen"):
        return "abdomen"
    return "body"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--flybody", required=True, type=Path, help="clone of github.com/TuragaLab/flybody")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--budget", type=int, default=90000, help="approximate triangle budget")
    args = ap.parse_args()
    assets = args.flybody / "flybody" / "fruitfly" / "assets"
    bodies, mscale = parse(assets / "fruitfly.xml")

    # load all meshes in their body frames
    parts = []
    for b in bodies:
        for g in b.geoms:
            if g["name"] in SKIP:
                continue
            v, f = load_obj(assets / g["file"])
            v = (qmat(g["quat"]) @ (v * mscale).T).T + g["pos"]
            parts.append({"body": b, "geom": g, "v": v, "f": f, "mat": material_for(b.name, g["material"])})

    # triangle budget per source material, split by original size
    by_mat: dict[str, int] = {}
    for p in parts:
        by_mat[p["geom"]["material"]] = by_mat.get(p["geom"]["material"], 0) + len(p["f"])
    total = 0
    for p in parts:
        m = p["geom"]["material"]
        share = WEIGHTS.get(m, 0.02) * args.budget * len(p["f"]) / by_mat[m]
        p["v"], p["f"] = simplify(p["v"], p["f"], max(MIN_TRIS, int(share)))
        total += len(p["f"])

    # world positions at rest, for texture coordinates and the bounding box
    for p in parts:
        b = p["body"]
        p["w"] = (qmat(b.world_q) @ p["v"].T).T + b.world_p

    # texture coordinates
    thorax_w = np.concatenate([p["w"] for p in parts if p["mat"] == "thorax"])
    t_lo, t_hi = thorax_w.min(axis=0), thorax_w.max(axis=0)
    abd_w = np.concatenate([p["w"] for p in parts if p["mat"] in ("abdomen", "lower")])
    abd_center = abd_w.mean(axis=0)
    # abdomen axis: from its front (nearest the thorax) to its tip
    ax_dir = abd_w[np.argmin(abd_w[:, 0])] - abd_center
    ax_dir /= np.linalg.norm(ax_dir)
    proj = (abd_w - abd_center) @ ax_dir
    a0 = abd_center + ax_dir * proj.min()
    a1 = abd_center + ax_dir * proj.max()
    wing_info = {}
    for p in parts:
        w = p["w"]
        if p["mat"] == "eye":
            uv = np.zeros((len(w), 2))
            for side in (1, -1):
                sel = (w[:, 1] * side) > 0
                uv[sel] = uv_eye(w[sel], side)
            p["uv"] = uv
        elif p["mat"] == "thorax" or (p["mat"] == "bristle" and p["body"].name == "thorax"):
            p["uv"] = uv_dorsal(w, (t_lo + t_hi) / 2, (t_hi - t_lo)[:2] * 1.05)
        elif p["mat"] in ("abdomen", "lower"):
            p["uv"] = uv_cylinder(w, a0, a1)
        elif p["mat"] == "wing":
            uv, _ = uv_wing(p["v"], np.zeros(3))
            if p["body"].name.endswith("right"):
                uv[:, 1] = 1 - uv[:, 1]
            p["uv"] = uv
            wing_info[p["body"].name] = True
        else:
            p["uv"] = None

    # decide the leading edge of the left wing so the texture is not mirrored
    # (the costa should face forward when the wing is spread)
    for p in parts:
        if p["mat"] != "wing":
            continue
        b = p["body"]
        spread = qmul(b.quat, qaxis([0, 0, 1], 0))  # joints at zero: wing out to the side
        wq = qmul(b.parent.world_q, spread)
        wp = (qmat(wq) @ p["v"].T).T
        front = wp[:, 0]
        # the texture's top row (v = 1 after flipY) is the leading edge
        corr = np.corrcoef(p["uv"][:, 1], front)[0, 1]
        if corr < 0:
            p["uv"][:, 1] = 1 - p["uv"][:, 1]

    # gather per body
    allw = np.concatenate([p["w"] for p in parts])
    lo, hi = allw.min(axis=0), allw.max(axis=0)
    length = hi[0] - lo[0]
    print(f"triangles {total}, length {length:.3f} cm, bbox {lo.round(3)} {hi.round(3)}")

    W = Writer()
    node_of = {}
    geom_of = {}
    for b in bodies:
        prims = {}
        for p in parts:
            if p["body"] is not b:
                continue
            key = p["mat"]
            prims.setdefault(key, []).append(p)
        mesh_prims = []
        for key, ps in prims.items():
            vs, fs, uvs, off = [], [], [], 0
            has_uv = all(p["uv"] is not None for p in ps)
            for p in ps:
                vs.append(p["v"])
                fs.append(p["f"] + off)
                off += len(p["v"])
                if has_uv:
                    uvs.append(p["uv"])
            v = np.concatenate(vs)
            f = np.concatenate(fs)
            mesh_prims.append((W.material(key, PALETTE[key]), v, normals(v, f), np.concatenate(uvs) if has_uv else None, f))
        node = gl.Node(name=b.name, translation=b.pos.tolist(), rotation=[*b.rest[1:], b.rest[0]])
        if b.joints:
            node.extras = {"quat0": [*b.quat[1:], b.quat[0]], "joints": b.joints}
        W.g.nodes.append(node)
        node_of[b.name] = len(W.g.nodes) - 1
        # the mesh hangs on its own child node: mesh compression may give that node a
        # dequantising scale and offset, which must not mix with the joint rotation
        if mesh_prims:
            W.g.nodes.append(gl.Node(name=f"{b.name}_geom", mesh=W.mesh(b.name, mesh_prims)))
            geom_of[b.name] = len(W.g.nodes) - 1
    for b in bodies:
        kids = [node_of[c.name] for c in b.children]
        if b.name in geom_of:
            kids.insert(0, geom_of[b.name])
        if kids:
            W.g.nodes[node_of[b.name]].children = kids

    # root: MuJoCo is z up with x forward; three.js is y up. Scale so the fly
    # is 1 unit long, facing +x, with its lowest point on y = 0.
    s = 1.0 / length
    rot = qaxis([1, 0, 0], -math.pi / 2)  # (x, y, z) -> (x, z, -y)
    cx = (lo[0] + hi[0]) / 2
    W.g.nodes.append(gl.Node(
        name="fly", children=[node_of[bodies[0].name]],
        rotation=[*rot[1:], rot[0]], scale=[s, s, s],
        translation=[-cx * s, -lo[2] * s, 0.0],
        extras={"source": "flybody (TuragaLab), Apache-2.0", "lengthCm": round(length, 4)},
    ))
    W.g.scenes = [gl.Scene(nodes=[len(W.g.nodes) - 1])]
    W.g.scene = 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    W.save(args.out)
    print(f"wrote {args.out} ({args.out.stat().st_size / 1e6:.2f} MB)")
    print(json.dumps({m: sum(len(p['f']) for p in parts if p['mat'] == m) for m in PALETTE}))


if __name__ == "__main__":
    main()
