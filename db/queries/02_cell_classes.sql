-- 02. What is this nervous system made of?
--     psql $DATABASE_URL -v species=c-elegans -f db/queries/02_cell_classes.sql
\if :{?species} \else \set species c-elegans \endif
SELECT
    n.super_class,
    COUNT(*)                                                        AS neurons,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)              AS pct_of_system,
    COUNT(*) FILTER (WHERE s.sign = 1)                              AS excitatory,
    COUNT(*) FILTER (WHERE s.sign = -1)                             AS inhibitory,
    COUNT(*) FILTER (WHERE COALESCE(s.sign, 0) = 0)                 AS modulatory_or_unknown
FROM neurons n
LEFT JOIN nt_sign s ON s.species_id = n.species_id AND s.nt_type = COALESCE(n.nt_type, '')
WHERE n.species_id = :'species'
GROUP BY n.super_class
ORDER BY neurons DESC;
