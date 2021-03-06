
exports.up = async function (knex) {
  await knex.schema.createTable('lecturers', function (table) {
    table.increments('id').primary()
    table.string('lecturer_id').notNullable()
    table.string('position_name')
    table.string('firstname').notNullable()
    table.string('lastname').notNullable()
    table.string('email')
    table.string('profile_picture')
    table.boolean('isAdmin').defaultTo(false)

    table
      .timestamp('created_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP'))
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

    table.unique('lecturer_id')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('lecturers')
}
