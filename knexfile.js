module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: 'db.evcohbgbypekeqdzgfgl.supabase.co',
      user: 'postgres',
      password: 'Prayash@2002',
      database: 'postgres',
      port: 5432,
      ssl: { rejectUnauthorized: false }  // important for Supabase
    },
    migrations: {
      directory: './migrations',
    },
  },
};
