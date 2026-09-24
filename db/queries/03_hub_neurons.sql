-- 03. Hubs: the most connected neurons, globally and within each class.
\if :{?species} \else \set species c-elegans \endif
SELECT *
FROM (
    SELECT
        neuron_id, cell_type, super_class, in_partners, out_partners,
        in_syn + out_syn                                            AS total_syn,
        RANK() OVER (ORDER BY in_syn + out_syn DESC)                AS global_rank,
        RANK() OVER (PARTITION BY super_class ORDER BY in_syn + out_syn DESC) AS rank_in_class
    FROM neuron_degree
    WHERE species_id = :'species'
) ranked
WHERE global_rank <= 15 OR rank_in_class = 1
ORDER BY global_rank;
