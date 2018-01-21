# Let's build a reddit clone!

![reddit](https://i.imgur.com/8IZ0jRT.jpg)

In this workshop we will start building a reddit clone. We will take our clone further next week as we learn more about HTTP and how to create web servers and services.

## Data model
For the first part of this workshop we will be building a simple data model for our reddit clone using a MySQL database. All the tables of our model should have a unique ID field as well as createdAt and updatedAt fields that will be timestamps. We will start with the following tables:

  * Users: each user should have an email, screen name, password.
  * Posts: each post should have the URL of the post, a title, and a reference to the user who posted it
  * Votes: each vote has a link to a user, a link to a post, and an up/down flag

Write the `CREATE TABLE` statements you are using in a file called `create.sql`, commit, push and **create a pull request for your master branch**.

## Implementing the data model with Sequelize
In class, we saw how we could tell Sequelize about an existing data model. It turns out that if we are starting a new project immediately with Sequelize, we can do even simpler.

We can tell Sequelize about our data model, and **let it `CREATE TABLE`s itself**, setup all the fields on it and figure out the correct types. All we need to do that is to run `sequelize.sync()` after having told it about our data model.

**NOTE**: *In a production system, we will NEVER use `sequelize.sync`!* Sequelize will try to modify or create table structures, and this can be completely destructive in an already running application. Regardless, it *is* a good way to get started :)

This code tells Sequelize about the three tables of our model:

```javascript
var User = db.define('user', {
    username: Sequelize.STRING,
    password: Sequelize.STRING, // TODO: make the passwords more secure!
    email: Sequelize.STRING
});

// Even though the content belongs to users, we will setup the userId relationship later
var Content = db.define('content', {
    url: Sequelize.STRING,
    title: Sequelize.STRING
});

// Even though a vote has a link to user and content, we will setup the relationship later
var Vote = db.define('vote', {
    upVote: Sequelize.BOOLEAN
});

// User <-> Content relationship
User.hasMany(Content); // This will add an `addContent` function on user objects
// IF i also need to associate content to users in that direction, I can add this relation. If not, I can remove it
//Content.belongsTo(User); // This will add a `setUser` function on content objects


// User <-> Vote <-> Content relationship
Content.belongsToMany(User, {through: Vote, as: 'Votes'}); // This will add an `addVote` function on content objects
// IF I also need to associate users to a vote in that direction, I can add this relation. If not, I can remove it.
//User.belongsToMany(Content, {through: Vote, as: 'Votes'}); // This will add an `addVote` function on user objects

db.sync(); // Only needs to be used once!
```
For this part of the workshop most of the code has already been written for you. You have to load the Sequelize library, setup a connection, and then run the code. The `db.sync()` at the end will actually create the tables, so you should start this with an **empty database**.

### Associations
A particular attention should be given for the associations part. Writing `User.hasMany(Content)` will let us write code like this: (**note** the difference between `User` the model and `user`, an instance of the model)

```javascript
User.create({
 username: 'hello',
 password: 'Hunter2',
 email: 'hello@world.com'
}).then(
 function(user) {
   // here we have access to the new user that was created
   // we can use the "magic function" `addContent` to add a new content related to the user:
   user.addContent({
    url: 'http://www.google.com',
    title: 'hello google!!!'
   });
 }
)
```

Later we go on to write `Content.belongsToMany(User, {through: Vote, as: 'Votes'})`. This creates a many-to-many relation between Content and User. A user can vote on many pieces of content, and a piece of content can be voted on by many users. The `through` option points to the join table.

In the most basic case, the join table will contain two foreign keys: one to the source model (`contentId`) and one to the target model (`userId`). In this case, the vote relation also needs to store the direction of the vote. For this reason, we are defining a `vote` model, and only giving it a `upVote` boolean attribute. Sequelize will take care of adding the two foreign keys as well as `createdAt` and `updatedAt`.

If you look a the `CREATE TABLE` for the `votes` table, you will see something different about it:

```sql
CREATE TABLE `votes` (
  `upVote` tinyint(1) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `userId` int(11) NOT NULL DEFAULT '0',
  `contentId` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`userId`,`contentId`),
  KEY `contentId` (`contentId`),
  CONSTRAINT `votes_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `votes_ibfk_2` FOREIGN KEY (`contentId`) REFERENCES `contents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8
```

In this case, Sequelize created a table without the ubiquitous auto-incrementing primary key id. Because the `votes` table is storing a relation, another primary key can be used here: the key is composed of the `userId` and the `contentId`. Since it's a primary key, each combination of `userId` and `contentId` is guaranteed to be unique across the table. **No matter what, a user will not be able to vote twice on the same content.** The database will simply reject a query that generates a second row with the same combination.

In addition to doing all of this for our many-to-many relation, Sequelize has a few more tricks up its sleeve. Because we setup the relation with the option `as` set to `Votes`, Sequelize will add a few magic methods to our `Content` model instances, since it is the source of the relation (we wrote `Content.belongsToMany`). Had we added the opposite side of the relation, the `User` model instances would have some magic methods as well. What are these methods?

Each `Content` instance will have among other things an `addVote` method. This will let us pass a `User` instance as well as the value for `upVote` (`true` for an upvote, or `false` for a downvote). We will also have a `getVotes` method. It will return the votes for the `Content` instance it was called on.

The following example makes use of `Promise`s. Comments have been put in place to help you understand what is going on. If the `Promise` part is not straightforward, concentrate on what happens in the last callback to `Promise.all`. This is where we finally have access to a `User` and `Content` instance to upvote on.

```javascript
var userPromise = User.findById(42); // userPromise is an object that we can use to get notified when the user is found
var contentPromise = Content.findById(245); // an object that we can use to get notified when the content is found

// Promise.all takes a promises array and can notify us when they are ALL "completed"
Promise.all([userPromise, contentPromise]).then(
  // results will be an array of [user, content]
  function(results) {
   var user = results[0];
   var content = results[1];
   
   // Upvote the content for that user. The function is called addVote because of the as: 'Vote' in the relation
   return user.addVote(content, {upVote: true}); // addVote() returns a promise. The result will be available in (*) below
  },
  // contrary to NodeJS-style callbacks where the same function gets an error OR a result, Promises use separate
  // success and error callbacks. the below function would be called if either userPromise or contentPromise fail
  function(err) {
   console.error("something went wrong!");
   console.error(err);
  }
).then(
  // This (*) is receiving the result of addVote() above! Why? The return value from the previous success callback
  // will be used to determine the value of the current one. Because we returned a Promise, we will receive the resolution
  // value of that promise here.
  function(vote) {
    console.log('Upvote successfully created!');
  }
)
```

The Sequelize documentation is complete, and even though it's not the easiest thing to read, this part of the workshop will make you read the Sequelize documentation on how to create models and their associations:

  * [Sequelize model definitions](http://docs.sequelizejs.com/en/latest/docs/models-definition/)
  * [Sequelize associations](http://docs.sequelizejs.com/en/latest/docs/associations/)

It is in your interest to **read and understand** these two sections of the documentation. You should also keep a bookmark to the Sequelize documentation site, as well as have it open at all times when coding with it :)

Create a file called `data-model.txt`. In it, write a few sentences to explain what each part of the data model definition is doing. **Commit and push so we can see it in your PR.**

## Get me some data
Now that we have told Sequelize about our data model, it's time to start writing our data functions. The following three sections of Sequelize's documentation will help you with writing the data functions:

  * [Sequelize model usage](http://docs.sequelizejs.com/en/latest/docs/models-usage/)
  * [Querying data with Sequelize](http://docs.sequelizejs.com/en/latest/docs/querying/)
  * [Sequelize instance methods](http://docs.sequelizejs.com/en/latest/docs/instances/) (*a bit less useful*)

Based on this documentation, write some Sequelize-based code for the following data functions. Continuing from the same file you created in part 2, do the following:

  1. Write a function called `createNewUser` that takes a username, password and callback. This function will [create a new user with Sequelize](http://docs.sequelizejs.com/en/latest/api/model/#createvalues-options-promiseinstance) and call the callback once the user has been created
  2. Write a function called `createNewContent` that takes a user *ID*, a URL, a title and a callback. This function will create a new Content item that is immediately associated with the user object passed to it. Once the content is created, your function will call the callback with that content.

  Note that you will have to [find the user by its ID](http://docs.sequelizejs.com/en/latest/api/model/#findbyidoptions-promiseinstance) before you can [associate the content to the user](http://docs.sequelizejs.com/en/latest/api/associations/).
  3. Write a function called `voteOnContent` that takes a content *ID*, user *ID*, a isUpVote boolean and a callback. This function will create a new vote for a piece of content and for the user that was passed to it.

  The [Sequelize associations documentation](http://docs.sequelizejs.com/en/latest/docs/associations/#associating-objects) will be of great help for this part.

Commit and push so we can see your work.
