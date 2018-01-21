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