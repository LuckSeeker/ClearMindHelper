SELECT * FROM events ORDER BY created_at DESC;

select * from drinks 
where party_id = 2
order by consumed_at desc;

select * from userthresholds;

update userthresholds
set threshold_bac = 0.03
where is_current = true and user_id = '00000000-0000-0000-0000-000000000000'

select * from parties order by updated_at desc;

delete from parties where id = 5;

select * from baccalculations
truncate parties cascade

select * from alerts order by triggered_at desc;