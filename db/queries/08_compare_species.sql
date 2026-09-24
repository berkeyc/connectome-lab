-- 08. Same statistics, different animals: reciprocity (chemical synapses only),
--     inhibition and wiring density compared across every species in the library.
WITH recip AS (
    SELECT e.species_id,
           COUNT(*)                                    AS edges,
           COUNT(r.pre_id)                             AS reciprocal_edges
    FROM edges e
    LEFT JOIN edges r ON r.species_id = e.species_id
                     AND r.pre_id = e.post_id AND r.post_id = e.pre_id
                     AND r.chem_count > 0
    WHERE e.chem_count > 0          -- gap junctions are symmetric by nature, skip them
    GROUP BY e.species_id
), inhib AS (
    SELECT n.species_id,
           ROUND(100.0 * COUNT(*) FILTER (WHERE s.sign = -1) / COUNT(*), 1) AS pct_inhibitory_neurons
    FROM neurons n
    LEFT JOIN nt_sign s ON s.species_id = n.species_id AND s.nt_type = COALESCE(n.nt_type, '')
    GROUP BY n.species_id
)
SELECT
    s.species_id,
    s.neurons,
    ROUND(100.0 * r.edges / (s.neurons::numeric * (s.neurons - 1)), 3) AS pct_of_possible_pairs,
    ROUND(100.0 * r.reciprocal_edges / r.edges, 1)                       AS pct_reciprocal,
    i.pct_inhibitory_neurons
FROM species_summary s
JOIN recip r USING (species_id)
JOIN inhib i USING (species_id)
ORDER BY s.neurons;
