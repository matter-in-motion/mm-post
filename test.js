'use strict';
const test = require('ava');
const extension = require('./index');
const createApp = require('mm-test').createApp;

const rxUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

process.env.NODE_ENV = 'production';
const app = createApp({
  extensions: [
    'rethinkdb',
    'rethinkdb-schema',
    'rethinkdb-unique',
    'db-schema',
    'user',
    'node',
    extension
  ],

  rethinkdb: {
    db: 'test',
    silent: true
  }
});

const post = app.units.require('resources.post.controller');

test.before(() => app.run('db', 'updateSchema'));
test.after.always(() => app.run('db', 'dropSchema'));

test('tests includes set', t => {
  t.deepEqual(post.includes(), [ 'content', 'author' ]);
});

test.serial('fails to create post with id', t => post
  .create({ id: 'fail' })
  .then(() => t.fail())
  .catch(err => t.is(err.message, 'New post data has a forbidden property id'))
);

test.serial('fails to get uknown post', t => post
  .get({ id: 'fail' })
  .then(() => t.fail())
  .catch(e => t.is(e.code, 4540))
);

test.serial('fails to update uknown post', t => post
  .update('fail', { title: 'WOW' })
  .then(() => t.fail())
  .catch(e => t.is(e.code, 4540))
);

let post1
test.serial('creates a post without content', t => post
  .create({
    title: 'Title',
    slug: 'title'
  })
  .then(post => {
    t.is(post.slug, 'title');
    t.is(post.title, 'Title');
    t.is(post.status, 'draft');
    t.is(post.created, post.published);
    t.regex(post.id, rxUUID);
    post1 = post;
  })
);

test.serial('gets a post by id without content', t => post
  .get({ id: post1.id })
  .then(post => {
    t.is(post.id, post1.id);
    t.is(post.title, post1.title);
    t.is(post.published, post1.published);
    t.is(post.created, post1.created);
    t.is(post.status, post1.status);
    t.is(post.slug, post1.slug);
    t.is(post.content, undefined);
  })
)

test.serial('gets a post by slug without content', t => post
  .get({ slug: post1.slug })
  .then(post => {
    t.is(post.id, post1.id);
    t.is(post.title, post1.title);
    t.is(post.published, post1.published);
    t.is(post.created, post1.created);
    t.is(post.status, post1.status);
    t.is(post.slug, post1.slug);
    t.is(post.content, undefined);
  })
)

let post2;
test.serial('creates a post with content and checks the order of content', t => post
  .create({
    slug: 'content',
    content: [
      {
        type: 'text',
        content: '0'
      },
      {
        type: 'text',
        content: '1'
      },
      {
        type: 'text',
        content: '2'
      }
    ]
  })
  .then(post => {
    post2 = post;
    t.is(post.slug, 'content');
    t.is(post.status, 'draft');
    t.is(post.created, post.published);
    t.regex(post.id, rxUUID);
    t.is(post.content.length, 3);

    post.content.forEach((id, i) => {
      t.is(post.nodes[id].content, `${i}`);
    });
  })
);

test.serial('fails to get with no request data', t => post
  .get()
  .then(() => t.fail())
  .catch(() => t.pass())
)

test.serial('gets all the posts', t => post
  .get({})
  .then(res => t.is(res.length, 2))
)

test.serial('gets a post by id with content', t => post
  .get({
    id: post2.id,
    include: [ 'content' ]
  })
  .then(post => t.deepEqual(post, post2))
);

test.serial('gets a post by slug with content', t => post
  .get({
    slug: post2.slug,
    include: [ 'content' ]
  })
  .then(posts => t.deepEqual(posts, post2))
);

test.serial('gets a post by slug with no author', t => post
  .get({
    slug: post2.slug,
    include: [ 'author' ]
  })
  .then(posts => t.is(posts.author, undefined))
);

test.serial('gets a post and tries to include non-existant property', t => post
  .get({
    id: post1.id,
    include: [ 'nope' ]
  })
  .then(post => t.is(post.id, post1.id))
);

test.serial('updates a post author to uknown and checks it', t => post
  .update(post1.id, { author: 'Unknown' })
  .then(res => t.is(res, post1.id))
  .then(() => post.get({
    slug: post1.slug,
    include: [ 'author' ]
  }))
  .then(posts => t.is(posts.author, null))
);

test.serial('gets all author posts', t => post
  .get({ author: 'Unknown' })
  .then(posts => t.is(posts.length, 1))
);

test.serial('adds a tag to post', t => post
  .update(post1.id, { tags: [ 'tag' ] })
  .then(res => t.is(res, post1.id))
);

test.serial('gets posts by tag', t => post
  .get({ tags: [ 'tag' ] })
  .then(res => t.is(res[0].id, post1.id))
);

test.serial('gets posts by no tag', t => post
  .get({ tags: [ '-tag' ] })
  .then(res => t.is(res[0].id, post2.id))
);

test.serial('gets all draft posts', t => post
  .get({ status: 'draft' })
  .then(posts => t.is(posts.length, 2))
);

test.serial('gets all published posts', t => post
  .get({ status: 'published' })
  .then(posts => t.is(posts.length, 0))
);

const DAY = 24 * 60 * 60 * 1000;
test.serial('gets all posts published between dates', t => post
  .get({ published: [ Date.now() - DAY, Date.now() + DAY ] })
  .then(posts => t.is(posts.length, 2))
);

test.serial('gets all posts published before now', t => post
  .get({ published: Date.now() })
  .then(posts => t.is(posts.length, 2))
);

test.serial('gets all posts ordered by asc created date', t => post
  .get({ order: 'created' })
  .then(posts => {
    t.is(posts.length, 2);
    t.true(posts[0].created < posts[1].created);
  })
);

test.serial('gets quantity of the posts ordered by desc created date', t => post
  .get({ order: '-created' })
  .then(posts => {
    t.is(posts.length, 2);
    t.true(posts[0].created > posts[1].created);
  })
);

test.serial('gets quantity of the posts', t => post
  .get({ quantity: true })
  .then(posts => t.is(posts, 2))
);

test.serial('updates a post', t => post
  .update(post1.id, { title: 'New title' })
  .then(res => t.is(res, post1.id))
);

test.serial('updates a post status by id', t => post
  .update(post2.id, {
    title: 'New title',
    status: 'published'
  })
  .then(res => {
    t.is(res, post2.id);
    return post.get({ id: post2.id });
  })
  .then(post => t.true(post.published !== post2.published))
);

test.serial('creates a node', t => post
  .createNode(post1.id, {
    type: 'test',
    content: '2'
  })
  .then(id => t.regex(id, rxUUID))
);

test.serial('creates a node to the end', t => post
  .createNode(post1.id, {
    type: 'test',
    content: '3'
  }, 10)
  .then(id => t.regex(id, rxUUID))
);

test.serial('creates a node to the begining', t => post
  .createNode(post1.id, {
    type: 'test',
    content: '0'
  }, 0)
  .then(id => t.regex(id, rxUUID))
);

test.serial('creates a node in the middle', t => post
  .createNode(post1.id, {
    type: 'test',
    content: '1'
  }, 1)
  .then(id => t.regex(id, rxUUID))
);

let nids;
test.serial('checks the nodes order', t => post
  .get({
    id: post1.id,
    include: [ 'content' ]
  })
  .then(post => {
    nids = post.content;
    post.content.forEach((id, i) => {
      t.is(post.nodes[id].content, `${i}`);
    });
  })
);

test.serial('deletes a node', t => post
  .deleteNode(post1.id, nids[0])
  .then(id => t.is(id, nids[0]))
);

test.serial('deletes a post and checks that nodes also deleted', t => post
  .delete(post1.id)
  .then(id => t.is(id, post1.id))
  .then(() => post.nodes.deleteAll(nids))
  .then(res => t.is(res.deleted, 0))
);

test.serial('creates a post and deletes it', t => post
  .create({
    title: 'New',
    status: 'published',
    published: Date.now()
  })
  .then(p => {
    t.regex(p.id, rxUUID);
    return post
      .delete(p.id)
      .then(id => t.is(id, p.id));
  })
);

test.serial('changes post slug', t => post
  .update(post2.id, { slug: 'newslug' })
  .then(res => t.is(res, post2.id))
);

test.serial('fails to update post slug to exited one', t => post
  .update(post2.id, { slug: 'newslug' })
  .then(() => t.fail())
  .catch(err => t.is(err.code, 4500))
);
