
- Database functions start closed (default EXECUTE revoked from PUBLIC); grant only the roles that call them — anon only for public signing/calculator flows. Why: security-definer functions were callable by anyone.
