
exports.up = async function (knex) {
  await knex.schema.createTable('academic_term', function (table) {
    table.increments('id').primary()
    table.integer('academic_year_id').unsigned().references('academic_year.id')
    table.integer('term_id').unsigned().references('term.id')

    table
      .timestamp('created_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP'))
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

    table.unique(['academic_year_id', 'term_id'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('academic_term')
}
