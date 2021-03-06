
exports.up = async function (knex) {
  await knex.schema.createTable('projects', function (table) {
    table.increments('id').primary()
    table.string('project_name_th').notNullable()
    table.string('project_name_en').notNullable()
    table.text('project_detail')
    table.text('project_abstract')
    table.integer('project_type_id').unsigned().notNullable()
    table.boolean('isGroup').defaultTo(false).notNullable()
    table.boolean('haveOutsider').defaultTo(false).notNullable()
    table.boolean('isShow').defaultTo(false).notNullable()
    table.text('tool_techniq_detail')
    table.text('references')
    table.integer('count_viewer').defaultTo(0)
    table.integer('count_clap').defaultTo(0)
    table.integer('start_month')
    table.integer('start_year_th')
    table.integer('start_year_en')
    table.integer('end_month')
    table.integer('end_year_th')
    table.integer('end_year_en')

    table
      .timestamp('created_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP'))
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

    table.foreign('project_type_id').references('project_type.id')
    table.index('count_viewer')
    table.index('created_at')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('projects')
}
