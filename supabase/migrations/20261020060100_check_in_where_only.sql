-- SOS-137: on the check-in form only Where is required, so a check-in with no
-- other answer is valid. It still counts toward a space's check-in total.
-- submit_check_in()'s hourly limit per person and place still applies.

alter table private.check_ins
  drop constraint check_in_has_an_answer;
