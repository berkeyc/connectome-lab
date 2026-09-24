-- 06. The strongest short route between two cell types (recursive CTE).
--     psql $DATABASE_URL -v species=c-elegans -v from_type=ASH -v to_type=AVA -f ...
--     psql $DATABASE_URL -v species=fruit-fly-synthetic -v from_type=LC4 -v to_type=MN_leg -f ...
\if :{?species} \else \set species c-elegans \endif
\if :{?from_type} \else \set from_type ASH \endif
\if :{?to_type} \else \set to_type VA \endif
WITH RECURSIVE
start AS (
    SELECT neuron_id FROM neurons
    WHERE species_id = :'species' AND cell_type = :'from_type'
    ORDER BY neuron_id LIMIT 5
),
walk (neuron_id, hops, path, path_types, bottleneck) AS (
    SELECT s.neuron_id, 0, ARRAY[s.neuron_id], ARRAY[:'from_type'::text], NULL::int
    FROM start s
    UNION ALL
    SELECT e.post_id, w.hops + 1, w.path || e.post_id, w.path_types || n.cell_type,
           LEAST(COALESCE(w.bottleneck, e.chem_count), e.chem_count)
    FROM walk w
    JOIN edges e   ON e.species_id = :'species' AND e.pre_id = w.neuron_id
    JOIN neurons n ON n.species_id = :'species' AND n.neuron_id = e.post_id
    WHERE w.hops < 5
      AND e.chem_count >= 3
      AND e.post_id <> ALL (w.path)
      AND w.path_types[array_length(w.path_types, 1)] IS DISTINCT FROM :'to_type'
      -- prune: follow only each neuron's 4 strongest outputs
      AND e.post_id IN (SELECT e2.post_id FROM edges e2
                        WHERE e2.species_id = :'species' AND e2.pre_id = w.neuron_id
                          AND e2.chem_count IS NOT NULL
                        ORDER BY e2.chem_count DESC LIMIT 4)
)
SELECT hops, route, bottleneck_synapses
FROM (
    SELECT DISTINCT ON (array_to_string(path_types, ' > '))
        hops, array_to_string(path_types, ' > ') AS route, bottleneck AS bottleneck_synapses
    FROM walk
    WHERE path_types[array_length(path_types, 1)] = :'to_type'
    ORDER BY array_to_string(path_types, ' > '), bottleneck DESC
) best
ORDER BY hops, bottleneck_synapses DESC
LIMIT 10;
