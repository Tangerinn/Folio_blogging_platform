import { doc, p, h, ul, code, quote, img } from '../../utils/content.js';

const daysAgo = (n, hours = 0) => new Date(Date.now() - n * 86400000 - hours * 3600000).toISOString();

export function seed() {
  const users = [
    { id: 'u1', name: 'Tangerine', email: 'student@demo.com', password: 'password123', role: 'student', status: 'active', bio: 'CS sophomore. I write about study habits and small projects.', createdAt: daysAgo(90) },
    { id: 'u2', name: 'Daniel Okafor', email: 'daniel@demo.com', password: 'password123', role: 'student', status: 'active', bio: 'Physics major who likes explaining things twice.', createdAt: daysAgo(80) },
    { id: 'u3', name: 'Priya Nair', email: 'priya@demo.com', password: 'password123', role: 'student', status: 'active', bio: 'Design and HCI. Coffee-powered.', createdAt: daysAgo(70) },
    { id: 'u4', name: 'Leo Brandt', email: 'leo@demo.com', password: 'password123', role: 'student', status: 'suspended', bio: '', createdAt: daysAgo(60) },
    { id: 'a1', name: 'Folio Admin', email: 'admin@demo.com', password: 'admin123', role: 'admin', status: 'active', bio: 'Platform administrator.', createdAt: daysAgo(120) },
  ];

  const categories = [
    { id: 'c1', name: 'Study Tips', description: 'Techniques and habits that make learning stick.' },
    { id: 'c2', name: 'Programming', description: 'Code, tools, and project write-ups.' },
    { id: 'c3', name: 'Campus Life', description: 'Experiences beyond the classroom.' },
    { id: 'c4', name: 'Science', description: 'Explanations and lab notes.' },
    { id: 'c5', name: 'Design', description: 'Interfaces, type, and visual thinking.' },
  ];

  const posts = [
    {
      id: 'p1', authorId: 'u1', categoryId: 'c1', status: 'published',
      title: 'The two-pass method: how I stopped re-reading my notes',
      content: doc(
        p('For my first year I highlighted everything and re-read it the night before the exam. It felt productive. It was not.'),
        h('Pass one: write the questions'),
        p('After each lecture I spend ten minutes turning the slides into questions. Not summaries — questions I could be asked.'),
        h('Pass two: answer from memory'),
        p('Two days later I answer those questions with the notes closed. Whatever I cannot answer goes into a short list.'),
        ul('Questions first, answers later', 'Closed notes, always', 'Only the missed ones get a second look'),
        quote('Recognising an answer is not the same as being able to produce it.'),
        p('That last line changed how I study. If you try one thing this semester, try this.'),
      ),
      createdAt: daysAgo(12), publishedAt: daysAgo(12), updatedAt: daysAgo(12),
    },
    {
      id: 'p2', authorId: 'u2', categoryId: 'c4', status: 'published',
      title: 'Why the sky is blue, and why the sunset is not',
      content: doc(
        p('Rayleigh scattering is the usual answer, and it is correct, but it skips the interesting part.'),
        h('Short wavelengths scatter more'),
        p('Air molecules scatter blue light far more strongly than red. At midday the light reaches you from all over the sky, so the sky looks blue.'),
        img('https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1200', 'Sunset over the sea', 'At sunset the light travels through much more air.'),
        p('At sunset the path through the atmosphere is long. Most of the blue has already been scattered away before it reaches your eye, leaving the reds.'),
      ),
      createdAt: daysAgo(9), publishedAt: daysAgo(9), updatedAt: daysAgo(9),
    },
    {
      id: 'p3', authorId: 'u1', categoryId: 'c2', status: 'published',
      title: 'Building a tiny REST API in an afternoon',
      content: doc(
        p('I wanted to understand what a backend actually does, so I built the smallest useful one I could.'),
        h('The whole thing'),
        code("app.get('/health', (req, res) => {\n  res.json({ status: 'ok' });\n});"),
        p('Everything else — auth, validation, the database — is the same idea repeated: a request comes in, a function runs, a response goes out.'),
        h('What surprised me'),
        ul('Most of the work is validating input', 'Error messages matter more than I expected', 'Postman is a great way to see what is really happening'),
      ),
      createdAt: daysAgo(6), publishedAt: daysAgo(6), updatedAt: daysAgo(6),
    },
    {
      id: 'p4', authorId: 'u3', categoryId: 'c5', status: 'published',
      title: 'Typography is most of design',
      content: doc(
        p('If you only have one hour to improve an interface, spend it on type.'),
        h('Three quick wins'),
        ul('Increase line height to at least 1.5 for body text', 'Limit line length to about 70 characters', 'Use one display face and one text face, no more'),
        p('Readers will not tell you the page feels calmer. They will just keep reading.'),
      ),
      createdAt: daysAgo(4), publishedAt: daysAgo(4), updatedAt: daysAgo(4),
    },
    {
      id: 'p5', authorId: 'u2', categoryId: 'c3', status: 'published',
      title: 'Surviving your first all-nighter (and why you should avoid the second)',
      content: doc(
        p('Last month I stayed up until sunrise finishing a lab report. Here is what I learned about doing that badly.'),
        ul('Water beats a fourth coffee', 'Take a ten minute walk every two hours', 'Stop editing at 4am — you are making it worse'),
        p('The honest advice: plan backwards from the deadline, and start the day you get the assignment.'),
      ),
      createdAt: daysAgo(2), publishedAt: daysAgo(2), updatedAt: daysAgo(2),
    },
    {
      id: 'p6', authorId: 'u1', categoryId: 'c2', status: 'draft',
      title: 'Notes on learning React (draft)',
      content: doc(p('Components, props, state. Still working out how to explain useEffect.')),
      createdAt: daysAgo(1), publishedAt: null, updatedAt: daysAgo(1),
    },
  ];

  const comments = [
    { id: 'm1', postId: 'p1', authorId: 'u2', parentId: null, content: 'The closed-notes rule is the hard part for me. Do you allow yourself a peek?', createdAt: daysAgo(11) },
    { id: 'm2', postId: 'p1', authorId: 'u1', parentId: 'm1', content: 'No peeking — but I do mark the ones I missed so the second pass is shorter.', createdAt: daysAgo(11, -2) },
    { id: 'm3', postId: 'p1', authorId: 'u3', parentId: null, content: 'Tried this for my stats midterm and it helped a lot. Thank you!', createdAt: daysAgo(8) },
    { id: 'm4', postId: 'p3', authorId: 'u3', parentId: null, content: 'This is the clearest explanation of "what a backend is" I have read.', createdAt: daysAgo(5) },
    { id: 'm5', postId: 'p2', authorId: 'u4', parentId: null, content: 'Buy cheap watches at www.spam-example.test!!!', createdAt: daysAgo(3) },
  ];

  const bookmarks = [
    { id: 'b1', userId: 'u1', postId: 'p2', createdAt: daysAgo(8) },
    { id: 'b2', userId: 'u1', postId: 'p4', createdAt: daysAgo(3) },
  ];

  const notifications = [
    { id: 'n1', recipientId: 'u1', type: 'comment', message: 'Daniel Okafor commented on “The two-pass method”', postId: 'p1', read: false, createdAt: daysAgo(11) },
    { id: 'n2', recipientId: 'u1', type: 'comment', message: 'Priya Nair commented on “Building a tiny REST API in an afternoon”', postId: 'p3', read: true, createdAt: daysAgo(5) },
  ];

  const reports = [
    { id: 'r1', reporterId: 'u3', targetType: 'comment', targetId: 'm5', reason: 'Spam link in comment.', status: 'pending', createdAt: daysAgo(2) },
  ];

  return { users, categories, posts, comments, bookmarks, notifications, reports };
}
