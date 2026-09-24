-- 07. How many synapses separate each sense from the body's output neurons?
--     Output = descending neurons in flies, motor neurons in worms.
\if :{?species} \else \set species c-elegans \endif
\if :{?target_class} \else \set target_class motor \endif
WITH RECURSIVE reach (neuron_id, source_class, hops) AS (
    SELECT neuron_id, class, 0
    FROM neurons WHERE species_id = :'species' AND super_class = 'sensory'
    UNION
    SELECT e.post_id, r.source_class, r.hops + 1
    FROM reach r
    JOIN edges e ON e.species_id = :'species' AND e.pre_id = r.neuron_id
    WHERE r.hops < 5 AND e.syn_count >= 3
),
first_arrival AS (
    SELECT source_class, neuron_id, MIN(hops) AS hops FROM reach GROUP BY 1, 2
)
SELECT
    f.source_class                      AS sense,
    MIN(f.hops)                         AS min_hops,
    ROUND(AVG(f.hops), 2)               AS avg_hops,
    COUNT(DISTINCT f.neuron_id)         AS target_neurons_reached
FROM first_arrival f
JOIN neurons n ON n.species_id = :'species' AND n.neuron_id = f.neuron_id
              AND n.super_class = :'target_class'
GROUP BY f.source_class
ORDER BY min_hops, avg_hops;
