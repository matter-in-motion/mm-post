'use strict';
const errors = require('mm-errors');
const types = require('../types');

const ReqlDriverError = function(e) {
  if (e.name === 'ReqlDriverError') {
    throw errors.ServerError(null, e.msg);
  } else {
    throw e;
  }
}

module.exports = {
  __expose: true,

  get: function() {
    const include = {
      type: 'array',
      items: {
        type: 'string',
        enum: this.includes()
      }
    };

    const id = {
      type: 'object',
      additionalProperties: false,
      required: [ 'id' ],
      properties: {
        id: {
          type: 'string',
          format: 'uuid'
        },
        include
      }
    };

    const slug = {
      type: 'object',
      additionalProperties: false,
      required: [ 'slug' ],
      properties: {
        slug: types.slug(),
        include
      }
    };

    const collection = {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: types.status(),
        created: types.date(),
        published: types.date(),
        order: types.order(),
        tags: types.tags(),
        author: {
          type: 'string',
          format: 'uuid'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: this.settings.limit
        },
        quantity: {
          type: 'boolean'
        },
        include
      }
    };

    return {
      auth: {
        provider: 'user',
        required: 'optional'
      },
      title: 'Post',
      description: 'Returns a post or posts collection',
      request: {
        anyOf: [ id, slug, collection ]
      },

      response: {
        anyOf: [
          {
            type: 'array',
            items: types.post()
          },
          types.post(),
          {
            type: 'integer',
            minimum: 0
          }
        ]
      },

      call: (auth, data) => {
        // if no auth return only published posts
        if (!auth) {
          data.status = 'published';

          const now = Date.now();
          if (Array.isArray(data.published)) {
            if (data.published[1] === undefined || data.published[1] > now) {
              data.published[1] = now;
            }
          } else if (data.published === undefined || data.published > now) {
            data.published = now;
          }
        }

        return this.get(data)
          .catch(ReqlDriverError)
          .catch(errors.ifError('NotFound'));
      }
    }
  },

  create: function() {
    return {
      auth: {
        provider: 'user',
        required: true
      },
      title: 'Post',
      description: 'Creates a post',
      request: {
        type: 'object',
        additionalProperties: false,
        required: [ 'slug', 'title' ],
        properties: {
          slug: types.slug(),
          title: types.title(),
          status: types.status(),
          tags: types.tags(),
          content: types.nodes()
        }
      },
      response: types.post(),

      call: (auth, data) => {
        if (auth.id) {
          data.author = auth.id;
        }
        return this
          .create(data)
          .catch(ReqlDriverError)
          .catch(errors.ifError('BadRequest'));
      }
    }
  },

  update: function() {
    return {
      auth: {
        provider: 'user',
        required: true
      },
      title: 'Post',
      description: 'Updates a post',
      request: {
        type: 'object',
        additionalProperties: false,
        required: [ 'id', 'to' ],
        properties: {
          id: { format: 'uuid' },
          to: {
            type: 'object',
            additionalProperties: false,
            minProperties: 1,
            properties: {
              slug: types.slug(),
              title: types.title(),
              status: types.status(),
              nodes: types.nodes(),
              tags: types.tags(),
              published: {
                type: 'number',
                minValue: 0
              }
            }
          }
        }
      },

      response: { format: 'uuid' },

      call: (auth, data) => this
        .update(data.id, data.to)
        .catch(ReqlDriverError)
        .catch(errors.ifError('BadRequest'))
    }
  },

  delete: function() {
    return {
      auth: {
        provider: 'user',
        required: true
      },
      title: 'Post',
      description: 'Deletes a post',
      request: {
        type: 'object',
        additionalProperties: false,
        required: [ 'id' ],
        properties: {
          id: { format: 'uuid' }
        }
      },

      response: { format: 'uuid' },

      call: (auth, data) => this.delete(data.id).catch(ReqlDriverError)
    }
  },

  createNode: function() {
    return {
      auth: {
        provider: 'user',
        required: true
      },
      title: 'Post',
      description: 'Create a post\'s node',
      request: {
        type: 'object',
        additionalProperties: false,
        required: [ 'id', 'node' ],
        properties: {
          id: { format: 'uuid' },
          index: { type: 'integer' },
          node: {
            type: 'object',
            additionalProperties: false,
            required: [ 'type', 'content' ],
            properties: {
              type: { type: 'string' },
              content: {
                anyOf: [
                  { type: 'string' },
                  { type: 'object' }
                ]
              }
            }
          }
        }
      },

      response: { format: 'uuid' },

      call: (auth, data) => this
        .createNode(data.id, data.node, data.index)
        .catch(ReqlDriverError)
        .catch(errors.ifError('NotFound'))
    }
  },

  deleteNode: function() {
    return {
      auth: {
        provider: 'user',
        required: true
      },
      title: 'Post',
      description: 'Deletes a post\'s node',
      request: {
        type: 'object',
        additionalProperties: false,
        required: [ 'id', 'nid' ],
        properties: {
          id: { format: 'uuid' },
          nid: { format: 'uuid' }
        }
      },

      response: { format: 'uuid' },

      call: (auth, data) => this
        .deleteNode(data.id, data.nid)
        .catch(ReqlDriverError)
        .catch(errors.ifError('NotFound'))
    }
  }
};
