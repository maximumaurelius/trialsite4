const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const marked = require('marked');
const matter = require('gray-matter');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 4000;

// Configure marked options
marked.setOptions({
    gfm: true,
    breaks: true,
    smartLists: true
});

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/layouts'));

// Serve static files from the public directory
app.use(express.static('public'));

// Helper function to read and parse markdown files
async function getPost(slug) {
    try {
        const filePath = path.join(__dirname, 'src/content', `${slug}.md`);
        const content = await fs.readFile(filePath, 'utf-8');
        const { data, content: markdown } = matter(content);
        const html = marked.parse(markdown);
        return { ...data, content: html, url: `/blog/${slug}` };
    } catch (error) {
        console.error(`Error reading post ${slug}:`, error);
        throw error;
    }
}

// Helper function to get all blog posts
async function getAllPosts() {
    try {
        const contentDir = path.join(__dirname, 'src/content');
        const files = await fs.readdir(contentDir);
        const posts = await Promise.all(
            files
                .filter(file => file.endsWith('.md'))
                .map(async file => {
                    const slug = file.replace('.md', '');
                    try {
                        const post = await getPost(slug);
                        return { ...post, slug };
                    } catch (error) {
                        console.error(`Error processing post ${file}:`, error);
                        return null;
                    }
                })
        );
        return posts.filter(post => post !== null)
                   .sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error('Error getting posts:', error);
        return [];
    }
}

// Middleware to handle async errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
app.get('/', asyncHandler(async (req, res) => {
    const content = await ejs.renderFile(
        path.join(__dirname, 'src/layouts/home.ejs'),
        { title: 'Home', path: '/' }
    );
    res.render('base', {
        title: 'Home',
        path: '/',
        content,
        description: 'Welcome to our blog'
    });
}));

app.get('/blog', asyncHandler(async (req, res) => {
    const posts = await getAllPosts();
    const content = await ejs.renderFile(
        path.join(__dirname, 'src/layouts/blog-list.ejs'),
        { posts, title: 'Blog', path: '/blog' }
    );
    res.render('base', {
        title: 'Blog',
        path: '/blog',
        content,
        description: 'Read our latest blog posts'
    });
}));

app.get('/blog/:slug', asyncHandler(async (req, res) => {
    const post = await getPost(req.params.slug);
    if (!post) {
        return res.status(404).render('base', {
            title: '404 - Post Not Found',
            path: '/blog',
            content: '<h1>Post not found</h1>',
            description: 'The requested post could not be found'
        });
    }
    
    const content = await ejs.renderFile(
        path.join(__dirname, 'src/layouts/post.ejs'),
        { ...post, path: '/blog' }
    );
    res.render('base', {
        ...post,
        path: '/blog',
        content
    });
}));

app.get('/academy', asyncHandler(async (req, res) => {
    res.render('base', {
        title: 'Academy',
        path: '/academy',
        content: '<h1>Academy page coming soon!</h1>',
        description: 'Learn about our academy'
    });
}));

app.get('/login', asyncHandler(async (req, res) => {
    res.render('base', {
        title: 'Login',
        path: '/login',
        content: '<h1>Login page coming soon!</h1>',
        description: 'Login to your account'
    });
}));

// Handle 404
app.use((req, res) => {
    res.status(404).render('base', {
        title: '404 - Not Found',
        path: '',
        content: '<h1>Page not found</h1>',
        description: 'The requested page could not be found'
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).render('base', {
        title: 'Error',
        path: '',
        content: '<h1>Internal Server Error</h1><p>Sorry, something went wrong.</p>',
        description: 'An error occurred'
    });
});

// Start the server with error handling
const startServer = async (retries = 3) => {
    const tryPort = async (port) => {
        try {
            await new Promise((resolve, reject) => {
                const server = app.listen(port, () => {
                    console.log(`Server is running on http://localhost:${port}`);
                    resolve();
                }).on('error', reject);
            });
            return true;
        } catch (error) {
            if (error.code === 'EADDRINUSE') {
                console.log(`Port ${port} is in use, trying ${port + 1}...`);
                return false;
            }
            throw error;
        }
    };

    let currentPort = PORT;
    while (retries > 0) {
        if (await tryPort(currentPort)) {
            return;
        }
        currentPort++;
        retries--;
    }
    throw new Error('Could not find an available port');
};

// Initialize directories and start server
(async () => {
    try {
        // Ensure required directories exist
        const dirs = [
            'src/content',
            'src/layouts',
            'src/partials',
            'public/css',
            'public/images'
        ];

        for (const dir of dirs) {
            await fs.mkdir(path.join(__dirname, dir), { recursive: true });
        }

        // Start the server
        await startServer();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
})(); 