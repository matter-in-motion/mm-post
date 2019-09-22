'use strict';
const hooks = require('async-hooks');
const { NotFound } = require('mm-errors');

const util = require('../../util');
const toCamelCase = util.toCamelCase;
const getMethods = util.getMethods;

const isArray = Array.isArray;

function RDBNotFound(e) {
  if (e.msg === 'Not found') {
    throw NotFound();
  }

  throw e;
}

class Controller {
  constructor() {
    this.setSchema('posts');

    hooks(this)
      .will('include')
      .will('create')
      .will('update')
      .will('delete');

    this
      .did('update', changes => this.didUpdateDeleteOldSlug(changes))
      .did('update', changes => this.didUpdateSetPublishedDate(changes))
  }

  __initRequired = true

  __init(units) {
    this.table = this.schema.post.table;
    this.slugs = this.schema.slug.table;
    this.r = units.require('db.rethinkdb');
    this.unique = units.require('db.rethinkdb.unique');
    this.nodes = units.require('node.controller');
    this.users = units.require('user.controller');
    this.settings = {
      ...units.require('core.settings').post
    }
  }

  setSchema(name) {
    this.schema = {
      post: {
        db: 'rethinkdb',
        table: name,
        indexes: [ 'slug', 'author', 'created', 'published' ]
      },

      slug: {
        db: 'rethinkdb',
        table: `${name}_slugs`
      }
    }
  }

  get(opts) {
    return new Promise((resolve, reject) => {
      try {
        opts.limit = opts.id || !opts.limit ? undefined :
          this.settings.limit ? Math.min(opts.limit, this.settings.limit) : opts.limit;
        resolve(this._get(opts).catch(RDBNotFound));
      } catch (e) {
        reject(e);
      }
    });
  }

  _get(opts) {
    let q = this.select(opts);

    if (opts.quantity) {
      return q.count();
    }

    if (opts.limit) {
      q = q.limit(opts.limit);
    }

    return this.include(q, opts.include);
  }

  willCreate(post) {
    if (post.id) {
      throw new Error('New post data has a forbidden property id');
    }
  }

  create(post) {
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
          post.content = ids;
        }

        return this.r.table(this.table)
          .insert(post)
          .run();
      })
      .then(res => {
        post.id = res.generated_keys[0];

        if (post.content) {
          post.nodes = nodes.reduce(function(a, b, i) {
            a[post.content[i]] = b;
            return a;
          }, {});
        }

        return post;
      });
  }

  willUpdate(id, to) {
    if (to.slug) {
      return this.unique.ensure(this.slugs, to.slug);
    }
  }

  update(id, to) {
    return this.select({ id })
      .update(to, { returnChanges: true })('changes')
      .run()
      .catch(RDBNotFound)
      .then(changes => changes[0]);
  }

  didUpdateDeleteOldSlug(changes) {
    if (!(
      changes && changes.old_val &&
      changes.old_val.slug !== undefined &&
      changes.old_val.slug !== changes.new_val.slug
    )) {
      return changes
    }

    return this.unique
      .delete(this.slugs, changes.old_val.slug)
      .then(() => changes);
  }

  didUpdateSetPublishedDate(changes) {
    if (!(
      changes && changes.new_val &&
      changes.old_val.status !== changes.new_val.status &&
      changes.new_val.status === 'published'
    )) {
      return changes
    }

    return this
      .update(changes.new_val.id, {
        published: Date.now()
      })
      .then(() => changes);
  }

  didUpdate(changes) {
    return changes.old_val.id;
  }

  delete(id) {
    return this.select({ id })
      .delete({ returnChanges: true })('changes').nth(0)
      .run()
      .catch(RDBNotFound)
      .then(changes => {
        if (changes.old_val.slug) {
          return this.unique
            .delete(this.slugs, changes.old_val.slug)
            .then(() => changes)
        }

        return changes;
      })
      .then(changes => {
        const nodes = changes.old_val.content;
        return nodes ? this.nodes.deleteAll(nodes).then(() => changes) :
          changes
      })
  }

  didDelete(changes) {
    return changes.old_val.id;
  }

  select(opts) {
    const r = this.r;
    let q = r.table(this.table);
    q = this.getSelection(q, opts);

    if (!(opts.id || opts.slug)) {
      q = this.filter(q, opts);
    }

    return q.default(r.error('Not found'));
  }

  include(q, opts) {
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

    // if content isn't included set content true|flase
    if (!content) {
      q = q.without('content')
    }
    return q;
  }

  filter(q, opts) {
    q = this.filterDates(q, 'created', opts.created);
    q = this.filterDates(q, 'published', opts.published);
    q = this.filterAuthor(q, opts.author);
    q = this.filterTags(q, opts.tags);
    q = this.filterStatus(q, opts.status);
    return q;
  }

  getSelection(query, opts) {
    const r = this.r;

    if (opts.id) {
      return query.get(opts.id)
        .default(r.error('Not found'))
    }

    if (opts.slug) {
      return query.getAll(opts.slug, { index: 'slug' }).nth(0);
    }

    return query.orderBy(this.getOrder(opts.order));
  }

  getOrder(order, useIndex = true) {
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
  }

  // filters
  filterDates(query, name, value) {
    if (!value) {
      return query
    }

    if (isArray(value)) {
      return query.between(value[0], value[1], { index: name });
    }

    return query.filter(this.r.row(name).le(value));
  }

  filterStatus(query, value) {
    if (value === undefined || value === '*') {
      return query;
    }

    const r = this.r;
    const filter = value === 'published' ?
      r.and(
        r.row('status').eq(value),
        r.row('published').le(Date.now())
      ) :
      r.row('status').eq(value)

    return query.filter(filter);
  }

  filterAuthor(query, value) {
    if (!value) {
      return query;
    }

    return query.filter(this.r.row('author').eq(value));
  }

  filterTags(query, tags) {
    if (!(tags && tags.length)) {
      return query;
    }

    const present = [];
    const absent = [];
    for (const i in tags) {
      const tag = tags[i];
      if (tag[0] === '-') {
        absent.push(tag.substr(1))
      } else {
        present.push(tag);
      }
    }

    const r = this.r;

    if (present.length) {
      query = query.filter(
        r.row('tags').contains(r.args(present))
      );
    }

    if (absent.length) {
      query = query.filter(
        r.or(
          r.row.hasFields('tags').not(),
          r.row('tags').contains(r.args(absent)).not()
        )
      );
    }

    return query;
  }

  // includes
  includeContent(query) {
    const r = this.r;
    const nodeTable = this.nodes.table;

    return query.merge(post => r.branch(
      post.hasFields('content'),
      {
        nodes: post('content')
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
  }

  includeAuthor(query) {
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
  }

  includes() {
    return Array.from(getMethods(this, /^include(.{2,})/))
      .map(str => str.toLowerCase());
  }

  // nodes
  createNode(id, node, index) {
    const r = this.r;

    if (index === undefined || index < 0) {
      index = -1;
    }

    return this.nodes.create(node)
      .then(ids => r.table(this.table)
        .get(id)
        .replace(row => {
          const content = r.branch(
            row.hasFields('content'),
            row('content'),
            r.expr([])
          );

          return r.branch(
            r.expr(index !== -1).and(content.count().gt(index)),
            row.merge({ content: content.insertAt(index, ids[0]) }),
            row.merge({ content: content.append(ids[0]) })
          );
        })
        .run()
        .then(() => ids[0])
      );
  }

  deleteNode(id, nodeId) {
    return this.nodes.delete(nodeId)
      .then(() => this.r.table(this.table)
        .get(id)
        .replace(row => row.merge({
          content: row('content')
            .setDifference([ nodeId ])
        }))
        .run()
        .then(() => nodeId)
      );
  }
}

module.exports = Controller;
