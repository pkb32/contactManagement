/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
     return knex.schema.createTable('contacts', (table) => {
        table.increments('id').primary();
        table.string('phoneNumber');
        table.string('email');
        table.integer('linkedId');
        table.enu('linkPrecedence', ['primary', 'secondary']).defaultTo('primary');
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.fn.now());
        table.timestamp('deletedAt');
    });
    
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('contacts');  
};
