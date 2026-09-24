-- 01. The library at a glance: every species side by side.
--     psql $DATABASE_URL -f db/queries/01_library_overview.sql
SELECT
    species_id,
    common_name,
    status,
    neurons,
    neuron_pairs,
    synapses,
    cell_types,
    ROUND(neuron_pairs::numeric / NULLIF(neurons, 0), 1)   AS partners_per_neuron,
    ROUND(synapses::numeric / NULLIF(neuron_pairs, 0), 1)  AS synapses_per_pair
FROM species_summary
ORDER BY neurons DESC;
