
exports.up = async function (knex) {
  await knex.schema.createTable('student_address', function (table) {
    table.increments('id').primary()
    table.integer('students_profile_id').unsigned().notNullable()
    table.string('description')
    table.string('district')
    table.string('subdistrict')
    table.string('province')
    table.string('postcode')

    table
      .timestamp('created_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP'))
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

    table.foreign('students_profile_id').references('students_profile.id')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('student_address')
}
