export function SetupNotice() {
  return (
    <section className="page-wrap narrow">
      <p className="eyebrow">Database</p>
      <h1>Postgres is not ready yet.</h1>
      <p className="lede">
        Start the database, apply the migration, and seed the two Atlanta providers. Then reload this page.
      </p>
      <pre className="code-block">{`docker compose up -d --wait
npx prisma migrate deploy
npm run db:seed
npm run dev`}</pre>
    </section>
  );
}
