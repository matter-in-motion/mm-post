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
  - limit — number, default 20. Global limit number of returned posts in collection

## Post

The post is the ordered collection of nodes.

* __id__ — uuid, id of the post
* __slug__ — string, 60 chars max, a user- and SEO-friendly short unique text used in a URL to identify and describe post
* __title__ — string, 140 chars max.
* __status__ — string, `draft`, `ready`, `published`. Default `draft`.
* __created__ — integer. A timestamp when post was created
* __published__ — integer. A timestamp when post was published
* author — uuid or user data of the post's author
* tags — array of tag's slugs
* nodes — array of nodes ids
* content — object with all nodes

## API

### get

Returns a post or posts collection

**Request**

To all requests, you can add an `include` parameter that will add related data to the posts.

* **id** — post's id

or

* **slug** — post's slug

or

* status — filter by post's status.
* created — integer or array, timestamp. A timestamp to filter posts by created date. When two timestamps in the array provided it returns only posts between this timestamps.
* published — integer or array, timestamp. A timestamp to filter posts by published date. When two timestamps in the array provided it returns only posts between this timestamps.
* author — uuid, to filter posts by its author.
* tags — array of tag's slugs to filter by. You can use `-tag` to filter *out* posts that *have* this tag.
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
* tags — array of tag's slugs
* content — object with all nodes

**Response**

Full-formed post object.

### update

updates the post content

**Request**

* **to**
  - slug — string, post's slug
  - title — string, 140 chars max.
  - status — string, `draft`, `ready`, `published`. Default `draft`.
  - published — integer. A timestamp when post was published
  - tags — array of tag's slugs
  - nodes — array of nodes ids, to change the order of nodes

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
