-- Derived views, refreshed by pipeline/load_postgres.py after every load.

-- Neuron to neuron graph per species. Chemical synapses are summed across
-- regions and signed by the sender's transmitter (Dale's law); electrical
-- synapses (gap junctions) are kept separately and are unsigned.
CREATE MATERIALIZED VIEW edges AS
SELECT
    c.species_id,
    c.pre_id,
    c.post_id,
    SUM(c.syn_count) FILTER (WHERE c.syn_type = 'chemical')::INTEGER   AS chem_count,
    SUM(c.syn_count) FILTER (WHERE c.syn_type = 'electrical')::INTEGER AS gap_count,
    SUM(c.syn_count)::INTEGER                                          AS syn_count,
    COALESCE(MAX(s.sign), 0)                                           AS sign,
    (COALESCE(MAX(s.sign), 0)
        * COALESCE(SUM(c.syn_count) FILTER (WHERE c.syn_type = 'chemical'), 0))::INTEGER
                                                                       AS signed_weight
FROM connections c
JOIN neurons n       ON n.species_id = c.species_id AND n.neuron_id = c.pre_id
LEFT JOIN nt_sign s  ON s.species_id = c.species_id AND s.nt_type = COALESCE(n.nt_type, '')
GROUP BY c.species_id, c.pre_id, c.post_id;

CREATE UNIQUE INDEX idx_edges_pk   ON edges (species_id, pre_id, post_id);
CREATE INDEX        idx_edges_post ON edges (species_id, post_id);

CREATE MATERIALIZED VIEW neuron_degree AS
WITH o AS (
    SELECT species_id, pre_id AS neuron_id, COUNT(*) AS out_partners, SUM(syn_count) AS out_syn
    FROM edges GROUP BY 1, 2
), i AS (
    SELECT species_id, post_id AS neuron_id, COUNT(*) AS in_partners, SUM(syn_count) AS in_syn
    FROM edges GROUP BY 1, 2
)
SELECT
    n.species_id, n.neuron_id, n.super_class, n.cell_type,
    COALESCE(i.in_partners, 0)  AS in_partners,
    COALESCE(o.out_partners, 0) AS out_partners,
    COALESCE(i.in_syn, 0)       AS in_syn,
    COALESCE(o.out_syn, 0)      AS out_syn
FROM neurons n
LEFT JOIN i USING (species_id, neuron_id)
LEFT JOIN o USING (species_id, neuron_id);

CREATE UNIQUE INDEX idx_degree_pk ON neuron_degree (species_id, neuron_id);

-- One line per species for the library page
CREATE OR REPLACE VIEW species_summary AS
SELECT
    s.species_id, s.common_name, s.latin_name, s.status,
    (SELECT COUNT(*) FROM neurons n WHERE n.species_id = s.species_id)      AS neurons,
    (SELECT COUNT(*) FROM edges e WHERE e.species_id = s.species_id)        AS neuron_pairs,
    (SELECT COALESCE(SUM(syn_count), 0) FROM connections c
      WHERE c.species_id = s.species_id)                                    AS synapses,
    (SELECT COUNT(DISTINCT cell_type) FROM neurons n
      WHERE n.species_id = s.species_id)                                    AS cell_types
FROM species s;
