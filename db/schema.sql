-- Connectome Lab: one PostgreSQL schema for every species.
-- Load with: python pipeline/load_postgres.py

DROP MATERIALIZED VIEW IF EXISTS neuron_degree CASCADE;
DROP MATERIALIZED VIEW IF EXISTS edges CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS neurons CASCADE;
DROP TABLE IF EXISTS nt_sign CASCADE;
DROP TABLE IF EXISTS species CASCADE;

-- The library: one row per organism and dataset
CREATE TABLE species (
    species_id   TEXT PRIMARY KEY,           -- e.g. 'c-elegans', 'fruit-fly-flywire'
    common_name  TEXT NOT NULL,
    latin_name   TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('real', 'synthetic', 'import')),
    dataset      TEXT,
    source_url   TEXT,
    license      TEXT,
    meta         JSONB NOT NULL               -- full species.json (presets, readouts, sim settings)
);

-- Neuron ids are text so both FlyWire's 18 digit ids and worm names ('AVAL') fit
CREATE TABLE neurons (
    species_id   TEXT NOT NULL REFERENCES species(species_id) ON DELETE CASCADE,
    neuron_id    TEXT NOT NULL,
    super_class  TEXT,          -- sensory, interneuron, central, descending, motor ...
    class        TEXT,
    cell_type    TEXT,          -- bilateral pairs and repeated cells share a type
    side         TEXT,          -- left / right / center
    nt_type      TEXT,          -- transmitter code (ACH, GABA, GLUT, ...)
    nt_score     REAL,
    PRIMARY KEY (species_id, neuron_id)
);

-- A pair can connect in several regions and through two kinds of synapse
CREATE TABLE connections (
    species_id   TEXT NOT NULL,
    pre_id       TEXT NOT NULL,
    post_id      TEXT NOT NULL,
    region       TEXT NOT NULL DEFAULT 'all',          -- neuropil or 'all'
    syn_type     TEXT NOT NULL CHECK (syn_type IN ('chemical', 'electrical')),
    syn_count    INTEGER NOT NULL CHECK (syn_count > 0),
    PRIMARY KEY (species_id, pre_id, post_id, region, syn_type),
    FOREIGN KEY (species_id, pre_id)  REFERENCES neurons(species_id, neuron_id) ON DELETE CASCADE,
    FOREIGN KEY (species_id, post_id) REFERENCES neurons(species_id, neuron_id) ON DELETE CASCADE
);

-- Sign of a chemical synapse depends on the sender's transmitter, and the
-- convention can differ per species (glutamate in worms vs. flies)
CREATE TABLE nt_sign (
    species_id   TEXT NOT NULL REFERENCES species(species_id) ON DELETE CASCADE,
    nt_type      TEXT NOT NULL,
    sign         SMALLINT NOT NULL CHECK (sign IN (-1, 0, 1)),
    PRIMARY KEY (species_id, nt_type)
);

-- Experiments people run on the website, stored for sharing and comparison
CREATE TABLE experiments (
    experiment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id     TEXT NOT NULL REFERENCES species(species_id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    title          TEXT,
    config         JSONB NOT NULL,     -- stimulus, lesions, brain variant, seed
    results        JSONB               -- readouts and rates per cell type
);

CREATE INDEX idx_conn_post     ON connections (species_id, post_id);
CREATE INDEX idx_neur_type     ON neurons (species_id, cell_type);
CREATE INDEX idx_neur_class    ON neurons (species_id, super_class);
CREATE INDEX idx_exp_species   ON experiments (species_id, created_at DESC);
