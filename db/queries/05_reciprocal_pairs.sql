-- 05. Feedback loops: cell type pairs that connect in both directions.
\if :{?species} \else \set species c-elegans \endif
WITH recip AS (
    SELECT a.pre_id AS a_id, a.post_id AS b_id, a.syn_count + b.syn_count AS syn
    FROM edges a
    JOIN edges b ON b.species_id = a.species_id
                AND b.pre_id = a.post_id AND b.post_id = a.pre_id
    WHERE a.species_id = :'species' AND a.pre_id < a.post_id
      AND COALESCE(a.chem_count, 0) > 0 AND COALESCE(b.chem_count, 0) > 0
)
SELECT
    LEAST(na.cell_type, nb.cell_type) || ' <-> ' || GREATEST(na.cell_type, nb.cell_type) AS pair_type,
    COUNT(*)                        AS reciprocal_pairs,
    ROUND(AVG(syn), 1)              AS avg_synapses
FROM recip r
JOIN neurons na ON na.species_id = :'species' AND na.neuron_id = r.a_id
JOIN neurons nb ON nb.species_id = :'species' AND nb.neuron_id = r.b_id
GROUP BY 1
ORDER BY reciprocal_pairs DESC, avg_synapses DESC
LIMIT 15;
