# Matter In Motion. Post resource extension

[![NPM Version](https://img.shields.io/npm/v/mm-post.svg?style=flat-square)](https://www.npmjs.com/package/mm-post)
[![NPM Downloads](https://img.shields.io/npm/dt/mm-post.svg?style=flat-square)](https://www.npmjs.com/package/mm-post)

This extension adds a __post__ resource. It also requires [mm-node](https://github.com/matter-in-motion/mm-node) and [mm-user](https://github.com/matter-in-motion/mm-user) extensions

## Usage

[Extensions installation instructions](https://github.com/matter-in-motion/mm/blob/master/docs/extensions.md)

## Dependencies

* __[user](https://github.com/matter-in-motion/mm-user)__
* __[node](https://github.com/matter-in-motion/mm-node)__
* __[rethinkdb](https://github.com/matter-in-motion/mm-rethinkdb)__
* __[rethinkdb-unique](https://github.com/matter-in-motion/mm-rethinkdb-unique)__
* [db-schema](https://github.com/matter-in-motion/mm-db-schema)
* [rethinkdb-schema](https://github.com/matter-in-motion/mm-rethinkdb-schema)

## Settings

* post
  - limit — number, default 20. Global limit number of post collection

## Post

The post is the ordered collection of nodes.

* __id__ — uuid, the id of the post.
* __slug__ — string, 60 chars max, a user- and SEO-friendly short unique text used in a URL to identify and describe the post.
* __title__ — string, 140 chars max.
* __status__ — string, `draft`, `ready`, `published`. Default `draft`.
* __created__ — integer. A timestamp when the post is created.
* __published__ — integer. A timestamp when the post is published.
* author — uuid or user data of the post's author.
* tags — the array of tag's slugs.
* nodes — object with all nodes.
* content — the array of nodes ids.

## API

### get

Returns a post or posts collection.

**Request**

To all requests, you can add the `include` parameter that adds related data to the posts.

* **id** — post's id

or

* **slug** — post's slug

or

* status — filter by post's status.
* created — integer or array, timestamp, to filter the posts by created date. When two timestamps in the array provided, returns only posts between this timestamps.
* published — integer or array, timestamp, to filter posts by published date. When two timestamps in the array provided, returns only posts between this timestamps.
* author — uuid, to filter posts by its author.
* tags — an array of tag's slugs to filter by. You can use `-tag` to filter *out* posts that *have* this tag.
* order — string, the field name to order the posts by. Possible values `published`, `-published`, `created`, `-created`.
* limit — number, limit the number of returned posts. Can't be bigger than the limit in the settings.
* quantity — boolean, returns a number of posts instead of posts itself.


**Response**

A single post or array of matched posts.

### create

**Request**

Creates a new post.

* __slug__ — post's slug
* __title__ — string, 140 chars max.
* status — string, `draft`, `ready`, `published`. Default `draft`.
* tags — an array of tag's slugs
* content — object with all nodes

**Response**

Full-formed post object.

### update

updates the post content

**Request**

* **to**
  - slug — string, post's slug.
  - title — string, 140 chars max.
  - status — string, `draft`, `ready`, `published`. Default `draft`.
  - published — integer. A timestamp when the post is published.
  - tags — an array of tag's slugs.
  - content — an array of nodes ids, to change the order of nodes.

**Response**

* changed post id

### delete

Deletes post

**Request**

* __id__ — uuid, id of the post

**Response**

* deleted post id

### createNode

**Request**

Creates a new node in the post.

* __id__ — uuid, post's id
* __node__ for more info check the [node](https://github.com/matter-in-motion/mm-node) documentation
  * __type__
  * __content__

**Response**

new node's id

### deleteNode

**Request**

Deletes a node from the post.

* __id__ — uuid, post's id
* __nid__ — uuid, node's id
* index — integer, position index of the node

**Response**

* __id__ — uuid, deleted node id

## Controller Methods

TBD

License: MIT.
