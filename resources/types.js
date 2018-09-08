'use strict';

const slug = low => ({
  type: 'string',
  pattern: '^[-a-z0-9_]{' + (low || 1) + ',60}$'
});

const status = () => ({
  type: 'string',
  enum: [ 'draft', 'ready', 'published' ]
});

const tags = () => ({
  type: 'array',
  items: slug()
})

const order = () => ({
  type: 'string',
  enum: [ 'created', 'published', '-created', '-published' ]
});

const date = () => ({
  oneOf: [
    {
      type: 'array',
      items: {
        type: 'number',
        minValue: 0
      }
    },

    {
      type: 'number',
      minValue: 0
    }
  ]
});

const content = () => ({
  type: 'array',
  items: { format: 'uuid' }
});

const nodes = () => ({
  type: 'object',
  propertyNames: { format: 'uuid' }
})

const title = () => ({
  type: 'string',
  maxLength: 140
});

const post = () => ({
  type: 'object',
  required: [ 'id', 'created', 'published', 'status' ],
  additionalProperties: false,
  dependencies: {
    content: [ 'nodes' ],
    nodes: [ 'content' ]
  },
  properties: {
    id: { format: 'uuid' },
    author: { format: 'uuid' },
    slug: slug(),
    title: title(),
    status: status(),
    published: {
      type: 'number',
      minValue: 0
    },
    created: {
      type: 'number',
      minValue: 0
    },
    tags: tags(),
    nodes: nodes(),
    content: content()
  }
})

module.exports = { slug, status, date, title, tags, nodes, content, order, post };
