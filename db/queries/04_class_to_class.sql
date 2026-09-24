-- 04. Who talks to whom? Chemical and electrical traffic between classes.
\if :{?species} \else \set species c-elegans \endif
SELECT
    pre.super_class                                     AS from_class,
    post.super_class                                    AS to_class,
    SUM(e.chem_count)                                   AS chemical_synapses,
    SUM(e.gap_count)                                    AS gap_junctions,
    SUM(e.signed_weight)                                AS net_signed_drive,
    ROUND(100.0 * SUM(e.syn_count)
          / SUM(SUM(e.syn_count)) OVER (PARTITION BY pre.super_class), 1) AS pct_of_sender_output
FROM edges e
JOIN neurons pre  ON pre.species_id = e.species_id  AND pre.neuron_id = e.pre_id
JOIN neurons post ON post.species_id = e.species_id AND post.neuron_id = e.post_id
WHERE e.species_id = :'species'
GROUP BY pre.super_class, post.super_class
ORDER BY from_class, pct_of_sender_output DESC;
