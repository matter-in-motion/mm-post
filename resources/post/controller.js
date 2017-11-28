'use strict';
const Promise = require('bluebird');
const hooks = require('async-hooks');

const util = require('../../util');
const toCamelCase = util.toCamelCase;
const getMethods = util.getMethods;

const isArray = Array.isArray;

const errors = require('mm-errors');
const notFound = function(e) {
  if (e.msg === 'Not found') {
    throw errors.NotFound();
  }

  throw e;
}

const Controller = function() {
  hooks(this)
    .will('include')
    .will('create')
    .will('update')
    .will('delete');
};

Controller.prototype.schema = {
  post: {
    db: 'rethinkdb',
    table: 'posts',
    indexes: [ 'slug', 'author', 'created', 'published' ]
  },

  slug: {
    db: 'rethinkdb',
    table: 'posts_slugs'
  }
};

Controller.prototype.__init = function(units) {
  this.table = this.schema.post.table;
  this.slugs = this.schema.slug.table;
  this.r = units.require('db.rethinkdb');
  this.unique = units.require('db.rethinkdb.unique');
  this.nodes = units.require('node.controller');
  this.users = units.require('user.controller');
  this.settings = Object.assign({ limit: 20 }, units.require('core.settings').post);
};

Controller.prototype.get = function(opts) {
  return new Promise((resolve, reject) => {
    try {
      opts.limit = opts.id ? undefined : Math.min(opts.limit, this.settings.limit);
      resolve(this._get(opts).catch(notFound));
    } catch (e) {
      reject(e);
    }
  });
};

Controller.prototype._get = function(opts) {
  let q = this.select(opts);

  if (opts.quantity) {
    return q.count();
  }

  return this.include(q, opts.include);
};

Controller.prototype.willCreate = function(post) {
  if (post.id) {
    throw new Error('New post data has a forbidden property id');
  }
};

Controller.prototype.create = function(post) {
  post.created = Date.now();

  if (!post.status) {
    post.status = 'draft';
  }

  if (!post.published) {
    post.published = post.created;
  }

  let nodes;
  if (post.content) {
    nodes = post.content;
    delete post.content;
  }

  return Promise.resolve(post)
    .then(post => {
      if (post.slug) {
        return this.unique.ensure(this.slugs, post.slug);
      }
    })
    .then(() => {
      if (nodes) {
        return this.nodes.create(nodes);
      }
    })
    .then(ids => {
      if (ids && ids.length) {
        post.nodes = ids;
      }

      return this.r.table(this.table)
        .insert(post)
        .run();
    })
    .then(res => {
      post.id = res.generated_keys[0];

      if (post.nodes) {
        post.content = nodes.reduce(function(a, b, i) {
          a[post.nodes[i]] = b;
          return a;
        }, {});
      }

      return post;
    });
};

Controller.prototype.willUpdate = function(id, to) {
  if (to.slug) {
    return this.unique.ensure(this.slugs, to.slug);
  }
};

Controller.prototype.update = function(id, to) {
  return this.select({ id })
    .update(to, { returnChanges: true })('changes')
    .run()
    .catch(notFound)
    .then(changes => changes[0]);
};

Controller.prototype.didUpdate = function(changes) {
  return Promise.resolve(changes)
    .then(changes => {
      if (changes.old_val.slug !== undefined && changes.old_val.slug !== changes.new_val.slug) {
        return this.unique
          .delete(this.slugs, changes.old_val.slug)
          .then(() => changes);
      }
      return changes;
    })
    .then(changes => {
      if (changes.old_val.status !== changes.new_val.status &&
        changes.new_val.status === 'published'
      ) {
        return this.update(changes.new_val.id, { published: Date.now() });
      }

      return changes.old_val.id;
    });
};

Controller.prototype.delete = function(id) {
  return this.select({ id })
    .delete({ returnChanges: true })('changes').nth(0)
    .run()
    .catch(notFound)
    .then(changes => {
      if (changes.old_val.slug) {
        return this.unique
          .delete(this.slugs, changes.old_val.slug)
          .then(() => changes)
      }

      return changes;
    })
    .then(changes => {
      const nodes = changes.old_val.nodes;
      return nodes ? this.nodes.deleteAll(nodes).then(() => changes) :
        changes
    })
};

Controller.prototype.didDelete = function(changes) {
  return changes.old_val.id;
};

Controller.prototype.select = function(opts) {
  const r = this.r;
  let q = r.table(this.table);
  q = this.getSelection(q, opts);

  if (!(opts.id || opts.slug)) {
    q = this.filter(q, opts);

  }

  return q.default(r.error('Not found'));
};

Controller.prototype.include = function(q, opts) {
  let content = false;
  opts && opts.forEach(include => {
    if (include === 'content') {
      content = true;
    }

    const method = toCamelCase('include-' + include);
    if (this[method]) {
      q = this[method](q);
    }
  });

  if (!content) {
    q = q.merge(post => ({
      content: post.hasFields('nodes')
    })).without('nodes')
  }
  return q;
};

Controller.prototype.filter = function(q, opts) {
  q = this.filterDates(q, 'created', opts.created);
  q = this.filterDates(q, 'published', opts.published);
  q = this.filterAuthor(q, opts.author);
  q = this.filterTags(q, opts.tags);
  q = this.filterStatus(q, opts.status);
  return q;
};

Controller.prototype.getSelection = function(query, opts) {
  const r = this.r;

  if (opts.id) {
    return query.get(opts.id)
      .default(r.error('Not found'))
  }

  if (opts.slug) {
    return query.getAll(opts.slug, { index: 'slug' }).nth(0);
  }

  return query.orderBy(this.getOrder(opts.order));
};

Controller.prototype.getOrder = function(order, useIndex = true) {
  let field = 'published';
  let direction = 'desc';
  if (order) {
    if (order[0] === '-') {
      field = order.substr(1);
    } else {
      direction = 'asc';
      field = order;
    }
  }

  const rOrder = this.r[direction](field);
  return useIndex ? { index: rOrder } : rOrder;
};

// filters
Controller.prototype.filterDates = function(query, name, value) {
  if (value) {
    if (isArray(value)) {
      return query.between(value[0], value[1], { index: name });
    }

    return query.filter(this.r.row(name).le(value));
  }

  return query;
};

Controller.prototype.filterStatus = function(query, value) {
  if (value !== undefined) {
    const r = this.r;
    const filter = value === 'published' ?
      r.and(
        r.row('status').eq(value),
        r.row('published').le(Date.now())
      ) :
      r.row('status').eq(value)

    return query.filter(filter);
  }

  return query;
};

Controller.prototype.filterAuthor = function(query, value) {
  if (value) {
    return query.filter(this.r.row('author').eq(value));
  }

  return query;
};

Controller.prototype.filterTags = function(query, value) {
  if (
    !value || value === 'all' || value === 'everything' ||
    value[0] === 'all' || value[0] === 'everything'
  ) {
    return query;
  }

  value = isArray(value) ? value : [ value ]

  const r = this.r;
  return query.filter(
    r.row('tags').contains(r.args(value))
  );
};

// includes
Controller.prototype.includeContent = function(query) {
  let r = this.r;
  let nodeTable = this.nodes.table;

  return query.merge(post => r.branch(
    post.hasFields('nodes'),
    {
      content: post('nodes')
        .map(id => r.expr([
          id,
          r.table(nodeTable)
            .get(id)
            .without('id')
        ]))
        .coerceTo('object')
    },
    {}
  ));
};

Controller.prototype.includeAuthor = function(query) {
  const r = this.r;
  return query.merge(post => r.branch(
    post.hasFields('author'),
    {
      author: r.table(this.users.table)
        .get(post('author'))
        .without('auth', 'status')
        .default(null)
    },
    {}
  ));
};

Controller.prototype.includes = function() {
  return Array.from(getMethods(this, /^include(.{2,})/))
    .map(str => str.toLowerCase());
};

// nodes
Controller.prototype.createNode = function(id, node, index) {
  const r = this.r;

  if (index === undefined || index < 0) {
    index = -1;
  }

  return this.nodes.create(node)
    .then(ids => r.table(this.table)
      .get(id)
      .replace(row => {
        const nodes = r.branch(
          row.hasFields('nodes'),
          row('nodes'),
          r.expr([])
        );

        return r.branch(
          r.expr(index !== -1).and(nodes.count().gt(index)),
          row.merge({ nodes: nodes.insertAt(index, ids[0]) }),
          row.merge({ nodes: nodes.append(ids[0]) })
        );
      })
      .run()
      .then(() => ids[0])
    );
};

Controller.prototype.deleteNode = function(id, nodeId) {
  return this.nodes.delete(nodeId)
    .then(() => this.r.table(this.table)
      .get(id)
      .replace(row => row.merge({
        nodes: row('nodes')
          .setDifference([ nodeId ])
      }))
      .run()
      .then(() => nodeId)
    );
};


module.exports = Controller;
