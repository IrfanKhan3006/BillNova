-- Team logins used to take their domain from the business name, which gave
-- addresses like "makki@billcraftsindiaprivatelimited.com". They now use the
-- one platform domain, so move the existing ones across.
--
-- Only the generated team-login domain is rewritten; real addresses that
-- business owners signed up with (gmail.com, touristleader.com, ...) are
-- left alone.
UPDATE "users"
SET "email" = REPLACE("email", '@billcraftsindiaprivatelimited.com', '@billcrafts.com'),
    "updatedAt" = NOW()
WHERE "email" LIKE '%@billcraftsindiaprivatelimited.com';
