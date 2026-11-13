const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Bookmark = require('../models/Bookmark');
const Notification = require('../models/Notification');
const Report = require('../models/Report');

const daysAgo = (n, hours = 0) => new Date(Date.now() - n * 86400000 - hours * 3600000);

const p = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const li = (text) => ({ type: 'listItem', content: [p(text)] });
const ul = (...items) => ({ type: 'bulletList', content: items.map(li) });
const code = (text) => ({ type: 'codeBlock', content: [{ type: 'text', text }] });
const quote = (text) => ({ type: 'blockquote', content: [p(text)] });
const img = (src, alt, title) => ({ type: 'image', attrs: { src, alt, title } });
const doc = (...content) => ({ type: 'doc', content });

const DEMO_USERS = [
  {
    name: 'Tangerine',
    email: 'student@demo.com',
    password: 'password123',
    role: 'student',
    status: 'active',
    bio: 'CS sophomore. I write about study habits and small projects.',
  },
  {
    name: 'Daniel Okafor',
    email: 'daniel@demo.com',
    password: 'password123',
    role: 'student',
    status: 'active',
    bio: 'Physics major who likes explaining things twice.',
  },
  {
    name: 'Priya Nair',
    email: 'priya@demo.com',
    password: 'password123',
    role: 'student',
    status: 'active',
    bio: 'Design and HCI. Coffee-powered.',
  },
  {
    name: 'Leo Brandt',
    email: 'leo@demo.com',
    password: 'password123',
    role: 'student',
    status: 'suspended',
    bio: '',
  },
  {
    name: 'Folio Admin',
    email: 'admin@demo.com',
    password: 'admin1234',
    role: 'admin',
    status: 'active',
    bio: 'Platform administrator.',
  },
];

const DEMO_CATEGORIES = [
  { name: 'Study Tips', description: 'Techniques and habits that make learning stick.' },
  { name: 'Programming', description: 'Code, tools, and project write-ups.' },
  { name: 'Campus Life', description: 'Experiences beyond the classroom.' },
  { name: 'Science', description: 'Explanations and lab notes.' },
  { name: 'Design', description: 'Interfaces, type, and visual thinking.' },
];

const DEMO_POSTS = [
  {
    authorEmail: 'student@demo.com',
    categoryName: 'Study Tips',
    status: 'published',
    title: 'The two-pass method: how I stopped re-reading my notes',
    daysAgo: 12,
    content: doc(
      p('For my first year I highlighted everything and re-read it the night before the exam. It felt productive. It was not.'),
      h('Pass one: write the questions'),
      p('After each lecture I spend ten minutes turning the slides into questions. Not summaries — questions I could be asked.'),
      h('Pass two: answer from memory'),
      p('Two days later I answer those questions with the notes closed. Whatever I cannot answer goes into a short list.'),
      ul('Questions first, answers later', 'Closed notes, always', 'Only the missed ones get a second look'),
      quote('Recognising an answer is not the same as being able to produce it.'),
      p('That last line changed how I study. If you try one thing this semester, try this.')
    ),
  },
  {
    authorEmail: 'daniel@demo.com',
    categoryName: 'Science',
    status: 'published',
    title: 'Why the sky is blue, and why the sunset is not',
    daysAgo: 9,
    content: doc(
      p('Rayleigh scattering is the usual answer, and it is correct, but it skips the interesting part.'),
      h('Short wavelengths scatter more'),
      p('Air molecules scatter blue light far more strongly than red. At midday the light reaches you from all over the sky, so the sky looks blue.'),
      img('https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1200', 'Sunset over the sea', 'At sunset the light travels through much more air.'),
      p('At sunset the path through the atmosphere is long. Most of the blue has already been scattered away before it reaches your eye, leaving the reds.')
    ),
  },
  {
    authorEmail: 'student@demo.com',
    categoryName: 'Programming',
    status: 'published',
    title: 'Building a tiny REST API in an afternoon',
    daysAgo: 6,
    content: doc(
      p('I wanted to understand what a backend actually does, so I built the smallest useful one I could.'),
      h('The whole thing'),
      code("app.get('/health', (req, res) => {\n  res.json({ status: 'ok' });\n});"),
      p('Everything else — auth, validation, the database — is the same idea repeated: a request comes in, a function runs, a response goes out.'),
      h('What surprised me'),
      ul('Most of the work is validating input', 'Error messages matter more than I expected', 'Postman is a great way to see what is really happening')
    ),
  },
  {
    authorEmail: 'priya@demo.com',
    categoryName: 'Design',
    status: 'published',
    title: 'Typography is most of design',
    daysAgo: 4,
    content: doc(
      p('If you only have one hour to improve an interface, spend it on type.'),
      h('Three quick wins'),
      ul('Increase line height to at least 1.5 for body text', 'Limit line length to about 70 characters', 'Use one display face and one text face, no more'),
      p('Readers will not tell you the page feels calmer. They will just keep reading.')
    ),
  },
  {
    authorEmail: 'daniel@demo.com',
    categoryName: 'Campus Life',
    status: 'published',
    title: 'Surviving your first all-nighter (and why you should avoid the second)',
    daysAgo: 2,
    content: doc(
      p('Last month I stayed up until sunrise finishing a lab report. Here is what I learned about doing that badly.'),
      ul('Water beats a fourth coffee', 'Take a ten minute walk every two hours', 'Stop editing at 4am — you are making it worse'),
      p('The honest advice: plan backwards from the deadline, and start the day you get the assignment.')
    ),
  },
  {
    authorEmail: 'student@demo.com',
    categoryName: 'Programming',
    status: 'draft',
    title: 'Notes on learning React (draft)',
    daysAgo: 1,
    content: doc(p('Components, props, state. Still working out how to explain useEffect.')),
  },
];

const DEMO_COMMENTS = [
  {
    postTitle: 'The two-pass method: how I stopped re-reading my notes',
    authorEmail: 'daniel@demo.com',
    content: 'The closed-notes rule is the hard part for me. Do you allow yourself a peek?',
    daysAgo: 11,
    reply: {
      authorEmail: 'student@demo.com',
      content: 'No peeking — but I do mark the ones I missed so the second pass is shorter.',
      daysAgo: 10,
    },
  },
  {
    postTitle: 'The two-pass method: how I stopped re-reading my notes',
    authorEmail: 'priya@demo.com',
    content: 'Tried this for my stats midterm and it helped a lot. Thank you!',
    daysAgo: 8,
  },
  {
    postTitle: 'Building a tiny REST API in an afternoon',
    authorEmail: 'priya@demo.com',
    content: 'This is the clearest explanation of "what a backend is" I have read.',
    daysAgo: 5,
  },
  {
    postTitle: 'Surviving your first all-nighter (and why you should avoid the second)',
    authorEmail: 'leo@demo.com',
    content: 'Buy cheap watches at www.spam-example.test!!!',
    daysAgo: 3,
  },
];

const DEMO_BOOKMARKS = [
  {
    userEmail: 'student@demo.com',
    postTitle: 'Why the sky is blue, and why the sunset is not',
    daysAgo: 8,
  },
  {
    userEmail: 'student@demo.com',
    postTitle: 'Typography is most of design',
    daysAgo: 4,
  },
  {
    userEmail: 'priya@demo.com',
    postTitle: 'The two-pass method: how I stopped re-reading my notes',
    daysAgo: 3,
  },
];

const DEMO_NOTIFICATIONS = [
  {
    recipientEmail: 'student@demo.com',
    type: 'comment',
    message: 'Daniel Okafor commented on "The two-pass method: how I stopped re-reading my notes"',
    postTitle: 'The two-pass method: how I stopped re-reading my notes',
    read: false,
    daysAgo: 11,
  },
  {
    recipientEmail: 'student@demo.com',
    type: 'comment',
    message: 'Priya Nair commented on "The two-pass method: how I stopped re-reading my notes"',
    postTitle: 'The two-pass method: how I stopped re-reading my notes',
    read: true,
    daysAgo: 8,
  },
];

const DEMO_REPORTS = [
  {
    reporterEmail: 'student@demo.com',
    targetType: 'comment',
    postTitle: 'Surviving your first all-nighter (and why you should avoid the second)',
    commentContent: 'Buy cheap watches at www.spam-example.test!!!',
    reason: 'Spam link unrelated to the post.',
    status: 'pending',
    daysAgo: 2,
  },
];

async function seedDatabase({
  UserModel = User,
  CategoryModel = Category,
  PostModel = Post,
  CommentModel = null,
  BookmarkModel = null,
  NotificationModel = null,
  ReportModel = null,
} = {}) {
  const usersByEmail = new Map();
  let usersCreated = 0;

  for (const item of DEMO_USERS) {
    let user = await UserModel.findOne({ email: item.email });
    if (!user) {
      const passwordHash = await bcrypt.hash(item.password, 12);
      user = await UserModel.create({
        name: item.name,
        email: item.email,
        passwordHash,
        role: item.role,
        status: item.status,
        bio: item.bio,
      });
      usersCreated += 1;
    }
    usersByEmail.set(item.email, user);
  }

  const categoriesByName = new Map();
  let categoriesCreated = 0;

  for (const item of DEMO_CATEGORIES) {
    let cat = await CategoryModel.findOne({ name: item.name });
    if (!cat) {
      cat = await CategoryModel.create(item);
      categoriesCreated += 1;
    }
    categoriesByName.set(item.name, cat);
  }

  let postsCreated = 0;
  for (const item of DEMO_POSTS) {
    const author = usersByEmail.get(item.authorEmail);
    const category = categoriesByName.get(item.categoryName);
    const existing = await PostModel.findOne({ author: author._id, title: item.title });
    if (!existing) {
      const createdAt = daysAgo(item.daysAgo);
      await PostModel.create({
        title: item.title,
        content: item.content,
        author: author._id,
        category: category ? category._id : null,
        status: item.status,
        publishedAt: item.status === 'published' ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
      });
      postsCreated += 1;
    }
  }

  const result = { usersCreated, categoriesCreated, postsCreated };

  if (CommentModel) {
    let commentsCreated = 0;
    for (const item of DEMO_COMMENTS) {
      const post = await PostModel.findOne({ title: item.postTitle });
      const author = usersByEmail.get(item.authorEmail);
      if (!post || !author) continue;

      let parentComment = await CommentModel.findOne({
        post: post._id,
        author: author._id,
        content: item.content,
      });

      if (!parentComment) {
        const createdAt = daysAgo(item.daysAgo);
        parentComment = await CommentModel.create({
          post: post._id,
          author: author._id,
          parentId: null,
          content: item.content,
          createdAt,
          updatedAt: createdAt,
        });
        commentsCreated += 1;
      }

      if (item.reply) {
        const replyAuthor = usersByEmail.get(item.reply.authorEmail);
        if (replyAuthor) {
          const existingReply = await CommentModel.findOne({
            post: post._id,
            parentId: parentComment._id,
            author: replyAuthor._id,
            content: item.reply.content,
          });

          if (!existingReply) {
            const replyCreatedAt = daysAgo(item.reply.daysAgo);
            await CommentModel.create({
              post: post._id,
              author: replyAuthor._id,
              parentId: parentComment._id,
              content: item.reply.content,
              createdAt: replyCreatedAt,
              updatedAt: replyCreatedAt,
            });
            commentsCreated += 1;
          }
        }
      }
    }
    result.commentsCreated = commentsCreated;
  }

  if (BookmarkModel) {
    let bookmarksCreated = 0;
    for (const item of DEMO_BOOKMARKS) {
      const post = await PostModel.findOne({ title: item.postTitle });
      const user = usersByEmail.get(item.userEmail);
      if (!post || !user) continue;

      const existing = await BookmarkModel.findOne({
        userId: user._id,
        postId: post._id,
      });

      if (!existing) {
        const createdAt = daysAgo(item.daysAgo);
        await BookmarkModel.create({
          userId: user._id,
          postId: post._id,
          createdAt,
          updatedAt: createdAt,
        });
        bookmarksCreated += 1;
      }
    }
    result.bookmarksCreated = bookmarksCreated;
  }

  if (NotificationModel) {
    let notificationsCreated = 0;
    for (const item of DEMO_NOTIFICATIONS) {
      const recipient = usersByEmail.get(item.recipientEmail);
      const post = await PostModel.findOne({ title: item.postTitle });
      if (!recipient || !post) continue;

      const existing = await NotificationModel.findOne({
        recipient: recipient._id,
        post: post._id,
        message: item.message,
      });

      if (!existing) {
        const createdAt = daysAgo(item.daysAgo);
        await NotificationModel.create({
          recipient: recipient._id,
          type: item.type,
          message: item.message,
          post: post._id,
          read: item.read,
          createdAt,
          updatedAt: createdAt,
        });
        notificationsCreated += 1;
      }
    }
    result.notificationsCreated = notificationsCreated;
  }

  if (ReportModel && CommentModel) {
    let reportsCreated = 0;
    for (const item of DEMO_REPORTS) {
      const reporter = usersByEmail.get(item.reporterEmail);
      const post = await PostModel.findOne({ title: item.postTitle });
      if (!reporter || !post) continue;

      const targetComment = await CommentModel.findOne({
        post: post._id,
        content: item.commentContent,
      });
      if (!targetComment) continue;

      const existing = await ReportModel.findOne({
        reporter: reporter._id,
        targetType: item.targetType,
        targetId: targetComment._id,
      });

      if (!existing) {
        const createdAt = daysAgo(item.daysAgo);
        await ReportModel.create({
          reporter: reporter._id,
          targetType: item.targetType,
          targetId: targetComment._id,
          reason: item.reason,
          status: item.status,
          createdAt,
          updatedAt: createdAt,
        });
        reportsCreated += 1;
      }
    }
    result.reportsCreated = reportsCreated;
  }

  return result;
}

async function main() {
  try {
    await connectDB();
    const summary = await seedDatabase({
      CommentModel: Comment,
      BookmarkModel: Bookmark,
      NotificationModel: Notification,
      ReportModel: Report,
    });
    console.log('Seed complete:', summary);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  seedDatabase,
  DEMO_USERS,
  DEMO_CATEGORIES,
  DEMO_POSTS,
  DEMO_COMMENTS,
  DEMO_BOOKMARKS,
  DEMO_NOTIFICATIONS,
  DEMO_REPORTS,
};

