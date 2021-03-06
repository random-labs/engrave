let moment = require('moment');
var showdown = require('showdown')
var converter = new showdown.Converter();
const removeMd = require('remove-markdown');
var striptags = require('striptags');
var steem = require('steem');
var url = require('url');

var cfg = require('../config');

let urlEmbed = require('url-embed');
let EmbedEngine = urlEmbed.EmbedEngine;
let Embed = urlEmbed.Embed;

let engine = new EmbedEngine({
    timeoutMs: 2000,
    referrer: 'www.example.com'
});

engine.registerDefaultProviders();

var Users = require('../models/users.js');

module.exports.sortByKey = (array, key) => {
    return array.sort(function (a, b) {
        var x = parseFloat(b[key]);
        var y = parseFloat(a[key]);
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

module.exports.sortByDate = (array, key) => {
    return array.sort(function (a, b) {
        var x = moment(a[key]).unix();;
        var y = moment(b[key]).unix();;
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

module.exports.isAuthenticated = (req, res, next) => {
    if(req.session.steemconnect) {
        return next();
    }
    res.redirect('/');
}

module.exports.isEditorAuthenticated = (req, res, next) => {
    if (req.session.steemconnect) {
        Users.findOne({ username: req.session.steemconnect.name }, function (err, user) {
            if (user && !err) {
                if (user.permissions == 'editor' || user.permissions == 'editor-in-chief') {
                    return next();
                } else if (user.permissions == 'requested') {
                    res.redirect('/dashboard/requested');
                } else {
                    res.redirect('/dashboard/request');
                }
            }
        })
    } else {
        res.redirect('/dashboard/login');
    }
}

String.prototype.trunc = String.prototype.trunc ||
    function (n) {
        return (this.length > n) ? this.substr(0, n - 1) + '...' : this;
    };

createYoutubeEmbed = (key) => {
    return '<iframe width="100%" height="375" src="https://www.youtube.com/embed/' + key + '" frameborder="0" allowfullscreen></iframe><br/>';
};

transformYoutubeLinks = (text) => {
    if (!text) return text;
    const self = this;

    const linkreg = /(?:)<a([^>]+)>(.+?)<\/a>/g;
    const fullreg = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([^& \n<]+)(?:[^ \n<]+)?/g;
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n<]+)(?:[^ \n<]+)?/g;

    let resultHtml = text;

    // get all the matches for youtube links using the first regex
    const match = text.match(fullreg);
    if (match && match.length > 0) {
        // get all links and put in placeholders
        const matchlinks = text.match(linkreg);
        if (matchlinks && matchlinks.length > 0) {
            for (var i = 0; i < matchlinks.length; i++) {
                resultHtml = resultHtml.replace(matchlinks[i], "#placeholder" + i + "#");
            }
        }

        // now go through the matches one by one
        for (var i = 0; i < match.length; i++) {
            // get the key out of the match using the second regex
            let matchParts = match[i].split(regex);
            // replace the full match with the embedded youtube code
            resultHtml = resultHtml.replace(match[i], createYoutubeEmbed(matchParts[1]));
        }

        // ok now put our links back where the placeholders were.
        if (matchlinks && matchlinks.length > 0) {
            for (var i = 0; i < matchlinks.length; i++) {
                resultHtml = resultHtml.replace("#placeholder" + i + "#", matchlinks[i]);
            }
        }
    }
    return resultHtml;
};

module.exports.transformTwitterLinks = (text, cb) => {
    if (!text) return text;
    const self = this;

    const linkreg = /(?:)<a([^>]+)>(.+?)<\/a>/g;
    const fullreg = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|t\.co\/)([^& \n<]+)(?:[^ \n<]+)?/g;
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|t\.co\/)([^& \n<]+)(?:[^ \n<]+)?/g;

    let resultHtml = text;

    // get all the matches for youtube links using the first regex
    const match = text.match(fullreg);
    if (match && match.length > 0) {
        // get all links and put in placeholders
        const matchlinks = text.match(linkreg);
        if (matchlinks && matchlinks.length > 0) {
            for (var i = 0; i < matchlinks.length; i++) {
                resultHtml = resultHtml.replace(matchlinks[i], "#placeholder" + i + "#");
            }
        }

        const twitter_links = resultHtml.match(fullreg);

        let embedArray = [];

        if (twitter_links) {
            twitter_links.forEach(link => {
                embedArray.push(new Embed(link));
            })
        }
        

        // Get multiple embeds 
        engine.getMultipleEmbeds(embedArray, function (error, results) {
            if (error) {
                console.log(error);
                // Something horrible killed the whole process. Spooky. 
            } else {

                // ok now put our links back where the placeholders were.
                if (matchlinks && matchlinks.length > 0) {
                    for (var i = 0; i < matchlinks.length; i++) {
                        resultHtml = resultHtml.replace("#placeholder" + i + "#", matchlinks[i]);
                    }
                }

                for (let i = 0; i < results.length; i++) {
                    let embed = results[i];

                    if (!embed.error) {
                        resultHtml = resultHtml.replace(embed.embedURL, embed.data.html);
                    }
                }
                
                if (cb) {
                    cb(resultHtml);
                }

            }
        });

    }

    else {
        if(cb) {
            cb(resultHtml);
        }
    }
};


module.exports.prepareSinglePostToRender = (steem_post, username) => {

    var category = module.exports.getCategorySlugFromSteemTag(steem_post.category);

    if(category == null) {
        category = steem_post.category.replace('pl-','');
    }
    var category_fullname = module.exports.getCategoryFullNameFromSteemTag(steem_post.category);
    if(category_fullname == null) {
        category_fullname = category;
    }

    var page_title = steem_post.title + " - " + cfg.get_config().blog_title;
    var article_title = steem_post.title;

    let tmp = exports.removeWebsiteAdvertsElements(striptags(steem_post.body));
    
    converter.setOption('tables', true);
    var body = converter.makeHtml(tmp);
    var value = parseFloat(parseFloat(steem_post.pending_payout_value.replace(" SBD", "")) + parseFloat(steem_post.curator_payout_value.replace(" SBD", "")) + parseFloat(steem_post.total_payout_value.replace(" SBD", ""))).toFixed(2);
    
    if(steem_post.json_metadata != '') {
        var metadata = JSON.parse(steem_post.json_metadata);
        if (metadata.image) {
            var imageLink = metadata.image[0]; // todo wyciaganie obrazka z tresci jesli nie ma w metadata
        }
        if (metadata.root_author) {
            var root_author = metadata.root_author;
        } else {
            var root_author = cfg.get_config().steem_username;
        }
    } else {
        var root_author = cfg.get_config().steem_username;
    }
    
    var comments_quantity = steem_post.children;
    var net_votes = steem_post.net_votes;
    var permlink = steem_post.permlink;
  
    var tags = [];
    var votes = [];
    var comments = [];

    var voted = false;

    for(i in steem_post.active_votes) {
        if (steem_post.active_votes[i].voter == username) {
            voted = true;
            break;
        }
    }

    var post = {
        category: category,
        category_fullname: category_fullname,
        date: steem_post.created,
        page_title: page_title,
        article_title: article_title,
        body: (transformYoutubeLinks(body)),
        body_abbr: striptags(body).slice(0, 150),
        image: imageLink,
        value: value,
        root_author: root_author,
        net_votes: net_votes,
        permlink: permlink,
        tags: tags,
        votes: votes,
        voted: voted,
        title: steem_post.title,
        comments_quantity: comments_quantity,
        comments: comments,
        url: steem_post.permlink
    };

    return post;
}

module.exports.prepareLoggedUserObject = (session) => {
    if(session.steemconnect) {
        var user = {
            name: session.steemconnect.name,
            profile_image: "https://d2g50grrs5gsgl.cloudfront.net/images/placeholders/default-user-pic-display-fp-25783b166928d6761389e6d34279290e.gif"
        }

        if (session.steemconnect.json_metadata) {
            var metadata = JSON.parse(session.steemconnect.json_metadata);
            if (metadata && ('profile' in metadata) && ('profile_image' in metadata.profile)) {
                user.profile_image = metadata.profile.profile_image;
            }
        }
        return user;
    }
}

module.exports.prepareDashboardUserObject = (session, cb) => {
    if (session.steemconnect) {

        Users.findOne({username: session.steemconnect.name}, function (err, db_user) {
            if(err) {
                console.log(err);
                if (cb) {
                    cb(err, null);
                }
            } else {
                if(db_user) {
                    var user = {
                        name: db_user.username,
                        permissions: db_user.permissions
                    }
                    if (cb) {
                        cb(null, user);
                    }
                } else {
                    if (cb) {
                        cb(null, null);
                    }
                }
            }
        })
    } 
}

module.exports.prepareSinglePostTags = (steem_post) => {
    var tags = [];
    if (steem_post.json_metadata) {
        let steem_tags = JSON.parse(steem_post.json_metadata).tags;
        if (steem_tags && Array.isArray(steem_tags)) {
            steem_tags.forEach(tag => {
                tags.push(tag.replace("pl-", ""));
            })
        }
    }
    return tags;
}

module.exports.prepareSinglePostComments = (steem_comments) => {

    var comments = [];

    steem_comments.forEach(comment => {
        var cmnt = {
            author: comment.author,
            net_votes: comment.net_votes,
            value: parseFloat(parseFloat(comment.pending_payout_value.replace(" SBD", "")) + parseFloat(comment.total_payout_value.replace(" SBD", ""))).toFixed(2),
            created: moment(new Date(comment.created)).format('LL LT'),
            permlink: comment.permlink,
            body: comment.body,
            replies: exports.prepareSinglePostComments(comment.replies)
        }
        comments.push(cmnt);
    });

    return comments;
}

module.exports.prepareCategoryListing = (category_name, steem_posts) => {

    var listing = [];
    var counter = 0;
    var posts = [];
    var imageLink = "";

    // todo if steem_posts in not empty

    if (steem_posts) {
        steem_posts.forEach(post => {

            if ((post.author == cfg.get_config().steem_username) && (module.exports.isPostInCategory(post.category, category_name)) ) {
                var metadata = JSON.parse(post.json_metadata);
                
                if (metadata.image) {
                    imageLink = metadata.image[0]; // todo wyciaganie obrazka z tresci jesli nie ma w metadata
                }
                if (metadata.root_author) {
                    var root_author = metadata.root_author;
                } else {
                    var root_author = cfg.get_config().steem_username;
                }

                var category = post.category.replace("pl-", "").replace("-", " ");
                var category_fullname = cfg.get_config().categories[post.category];
                if (!category_fullname) {
                    category_fullname = category;
                }
                var body = removeMd(post.body).trunc(150);
                var value = parseFloat(parseFloat(post.pending_payout_value.replace(" SBD", "")) + parseFloat(post.curator_payout_value.replace(" SBD", "")) +  parseFloat(post.total_payout_value.replace(" SBD", ""))).toFixed(2);

                var item = {
                    comments_quantity: post.children,
                    title: post.title,
                    value: value,
                    image: imageLink,
                    net_votes: post.net_votes,
                    category: category,
                    category_fullname: category_fullname,
                    root_author: root_author,
                    url: post.permlink,
                    date: post.created,
                    body: body
                };
                posts.push(item);
            }

            counter++;
            if (counter >= steem_posts.length) {
                if (category_name) {
                    if (cfg.get_config().categories[category_name]) {
                        var category_fullname = cfg.get_config().categories[category_name];
                    } else {
                        var category_fullname = cfg.get_config().categories["pl-" + category_name];
                    }
                    if (!category_fullname) {
                        category_fullname = category_name;
                    }
                    listing.page_title = category_fullname + " - " + cfg.get_config().blog_title;
                    listing.category = category_name;
                    listing.category_fullname = category_fullname;
                } else {
                    listing.page_title = cfg.get_config().blog_title + " - " + cfg.get_config().blog_slogan;
                    listing.category = "/";
                }

                listing.latest = posts;

                return listing;

            }
        });
    }

    return listing;
}

module.exports.prepareFeaturedPosts = (steem_posts) => {
    if (steem_posts && steem_posts.length) {
        return sortByKey(exports.prepareCategoryListing(null, steem_posts).latest, 'value').slice(0, 5);
    } else {
        return [];
    }
}

module.exports.removeWebsiteAdvertsElements = (body) => {

    let a = body.replace("***********\n\n### " + cfg.get_config().info_website_info_text, "");
    let b = a.replace(/(\*\*\*\*\*\*\*\*\*\*\*\n\nArtykuł autorstwa: @)(?:.*)(, dodany za pomocą serwisu )(?:.*)\(https:\/\/(?:.*)\)/g, "");
    let c = b.replace(/(\n\*\*\*\n\n###\sOriginally posted on \[)(.*)(\)\.\sSteem blog powered by \[)(.*)(\)\.)/g, "");
    let d = c.replace(/(\n\*\*\*\n\s###\sPierwotnie opublikowano na \[)(.*)(\)\.\sBlog na Steem napędzany przez \[)(.*)(\)\.)/g, "");
    return d;
}


module.exports.categoryGetFullName = (category) => {
    if (category) {
        if (cfg.get_config().categories[category]) {
            var category_fullname = cfg.get_config().categories[category];
        } else {
            var category_fullname = cfg.get_config().categories["pl-" + category];
        }

        if (!category_fullname) {
            category_fullname = category.replace("pl-","");
        }
        return category_fullname;
    } else {
        return null;
    }
}


///////////////////////////////////////







module.exports.dashboardPreparePostPreview = (article) => {

    var category_fullname = article.category;
    var category = "";

    for (key in cfg.get_config().categories) {
        if (cfg.get_config().categories[key] == article.category) {
            category = key;
        }
    }

    var date = moment(new Date(article.date)).format('LLLL');
    var page_title = article.title + " - " + cfg.get_config().blog_title;
    var article_title = article.title;

    var body = "![](" + article.image + ")\n\n";
    body += article.body;
    body += "\n\n***********";

    if (article.source_link != "") {
        if (article.source_title != "") {
            body += "\n\nŹródło: [" + article.source_title + "](" + article.source_link + ")";
        } else {
            body += "\n\nŹródło: [" + url.parse(article.source_link).hostname + "](" + article.source_link + ")";
        }
    }
    
    converter.setOption('tables', true);
    body = converter.makeHtml(body);
    var value = 0;
    var imageLink = article.image;
    var comments_quantity = 0;
    var net_votes = 0;
    var permlink = "/";
    
    var tags = [];
    var votes = [];
    var comments = [];

    var post = {
        category: category,
        category_fullname: category_fullname,
        date: article.date,
        page_title: page_title,
        article_title: article_title,
        body: transformYoutubeLinks(body),
        body_abbr: striptags(body).slice(0, 125),
        image: imageLink,
        value: value,
        root_author: article.user,
        net_votes: net_votes,
        permlink: permlink,
        tags: tags,
        votes: votes,
        comments_quantity: comments_quantity,
        comments: comments
    };

    return post;
}


module.exports.getUserFeed = function(limit, start_permlink, category, author, callback) {

    let cnt = 0;
    let posts = [];
    var start_author = cfg.get_config().steem_username;

    var query = {
        tag: cfg.get_config().steem_username,
        limit: 21
    };

    (function innerFunction() {

        if (start_permlink) {
            query.start_permlink = start_permlink;
            query.start_author = start_author;
        }

        steem.api.getDiscussionsByBlog(
            query,
            function (err, result) {

                if (err) {
                    console.log(err);
                    if (callback) {
                        callback();
                    }
                } else {
                    if (callback) {

                        if (start_permlink) {
                            result = result.slice(1, result.length)
                        }

                        if (cfg.get_config().posts_from_categories_only == "true" || cfg.get_config().posts_from_categories_only == true) {

                            result.forEach(element => {

                                if(element.json_metadata != '') {
                                    var metadata = JSON.parse(element.json_metadata);
                                    if (metadata.root_author) {
                                        var root_author = metadata.root_author
                                    }
                                } else {
                                    var root_author = cfg.get_config().steem_username;
                                }

                                var resteemed = (element.author != cfg.get_config().steem_username);

                                if (exports.isPostCategorized(element.category)) {
                                    if ((category == null && author == null) || element.category == category || element.category == "pl-" + category || (author && root_author == author)) {
                                        if (cnt < limit && !resteemed) {
                                            
                                            if(canPostBeDisplayed(element)) {
                                                posts.push(element);
                                                cnt++;
                                            }
                                        }
                                    }
                                }
                            });
                            if (cnt >= limit || (start_permlink == null && result.length < 21) || result.length + 1 < 21) {
                                callback(posts);
                            } else {
                                start_permlink = result[result.length-1].permlink;
                                start_author = result[result.length -1 ].author;
                                innerFunction();
                            }
                        } else {
                            result.forEach(element => {
                                var resteemed = (element.author != cfg.get_config().steem_username);


                                if(element.json_metadata != '') {
                                    var metadata = JSON.parse(element.json_metadata);
                                    if (metadata.root_author) {
                                        var root_author = metadata.root_author
                                    }
                                } else {
                                    var root_author = cfg.get_config().steem_username;
                                }
                                
                                if ((category == null && author == null) || element.category == category || element.category == "pl-" + category || (author && root_author == author)) {
                                    if (cnt < limit && !resteemed) {
                                        if(canPostBeDisplayed(element)) {
                                            posts.push(element);
                                            cnt++;
                                        }
                                    }
                                }
                            });
                            if (cnt >= limit || (start_permlink == null && result.length < 21) || result.length + 1 < 21) {
                                callback(posts);
                            } else {
                                start_permlink = result[result.length - 1].permlink;
                                start_author = result[result.length -1 ].author;
                                innerFunction();
                            }
                        }
                    }
                }
            });

        // innerFunction();	
    })();
}

module.exports.isCategoryValid = (category) => {
    let valid = false;
    cfg.get_config().categories.every(function(element, index) {
        if(element.slug == category) {
            valid = true;
            return false // break iteration
        }
        else return true
      })

    return valid;
}

module.exports.isPostInCategory = (post_category, category_name) => {
    let valid = false;
    if(category_name == null) {
        return true;
    } else {
        for(var i = 0; i < cfg.get_config().categories.length; i++) {
            if (cfg.get_config().categories[i].slug == category_name) {

                for(var j = 0; j < cfg.get_config().categories[i].tags.length; j++) {

                    if(cfg.get_config().categories[i].tags[j] == post_category) {
                        valid = true;
                        break;
                    }
                }
                break;
            }
        }
    }

    return valid;
};

function canPostBeDisplayed(post) {

    if(cfg.get_config().show_everything == 'true' || cfg.get_config().show_everything == true) {
        return true;
    }

    if((post.beneficiaries.length && (post.beneficiaries[0].account == 'nicniezgrublem' || post.beneficiaries[0].account == 'engrave') )) {
        
        let pattern_en = /(\n\*\*\*\n<center>\s###\sOriginally posted on \[)(.*)(\)\.\sSteem blog powered by \[)(.*)(\)\.\n\<\/center\>)/;
        let pattern_pl = /(\n\*\*\*\n<center>\s###\sPierwotnie opublikowano na \[)(.*)(\)\.\sBlog na Steem napędzany przez \[)(.*)(\)\.\n\<\/center\>)/;
        
        return pattern_en.test(post.body) || pattern_pl.test(post.body) ;
        
    } else {
        return false;
    }
}

module.exports.isPostCategorized = (post_tag) => {
    let valid = false;

    for(let i = 0; i < cfg.get_config().categories.length && !valid; i++) {

        for(let j = 0; j < cfg.get_config().categories[i].tags.length && !valid; j++) {

            if(cfg.get_config().categories[i].tags[j] == post_tag) {
                valid = true;
                break;
            }
        }
    }

    return valid;
};

module.exports.getCategorySlugFromSteemTag = (tag) => {

    for(var i = 0; i < cfg.get_config().categories.length; i++) {
        if(cfg.get_config().categories[i].steem_tag == tag) {
            return cfg.get_config().categories[i].slug;
        }
    }
    return null;
}

module.exports.getCategoryFullNameFromSteemTag = (tag) => {

    for(var i = 0; i < cfg.get_config().categories.length; i++) {
        if(cfg.get_config().categories[i].steem_tag == tag) {
            return cfg.get_config().categories[i].name;
        }
    }
    return null;
}

module.exports.getCategoryFullName = (slug) => {

    for(var i = 0; i < cfg.get_config().categories.length; i++) {
        if(cfg.get_config().categories[i].slug == slug) {
            return cfg.get_config().categories[i].name;
        }
    }
    return slug;
}

module.exports.isEditorAuthorized = () => {
    
}