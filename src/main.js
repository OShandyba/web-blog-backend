const RestLib = require('rest-library');
const { parseBodyMiddleware } = require('rest-library/utils.js')

const parseCookieMiddleware = require('./middleware/parseCookie.js')
const onlyAuthenticatedMiddleware = require('./middleware/onlyAuthenticated.js')
const authenticateMiddleware = require('./middleware/authenticate.js')
const sessionMiddleware = require('./middleware/session.js')

const connect = require('./database/connect.js')
const { addUser, getUserByCredentials } = require('./database/users.js')

const app = new RestLib()

const posts = []

app.setErrorHandler((ctx, error) => {
    console.error(error)

    ctx.response.send({
        error: error.message,
    }, 500)
})

app.use(parseBodyMiddleware)
app.use(parseCookieMiddleware)
app.use(sessionMiddleware)
app.use(authenticateMiddleware)

/**
 * ----------- AUTHENTICATION -----------
 */

app.post('/registration', async (ctx, next) => {
    const { body } = ctx.request

    if (body.login == null || body.password == null) {
        ctx.response.send({
            error: 'Invalid body',
        }, 400)
        next()
        return
    }
    const db = await connect()

    const user = {
        login: body.login,
        password: body.password,
    }
    await addUser(db, user)
    
    ctx.session.userId = user.id
    
    ctx.response.send(user)
    next()
})

app.post('/login', async (ctx, next) => {
    const { body } = ctx.request

    if (body.login == null || body.password == null) {
        ctx.response.send({
            error: 'Invalid body',
        }, 400)
        next()
        return
    }

    const db = await connect()
    const user = await getUserByCredentials(db, body.login, body.password)

    if (user) {
        ctx.session.userId = user.id
        ctx.response.send(user)
    } else {
        ctx.response.send({
            error: 'Invalid user data',
        }, 401)
    }

    next()
})

app.post('/logout', (ctx, next) => {
    delete ctx.session.userId
    ctx.response.send({
        message: 'Logout successful',
    })
    next()
})

/**
 * ----------- END AUTHENTICATION -----------
 */

/**
 * ----------- POSTS -----------
 */

app.get('/posts', (ctx, next) => {
    ctx.response.send(posts)

    next()
})

app.get('/post/:id', (ctx, next) => {
    const id = parseInt(ctx.request.params.id, 10)
    const post = posts.find(p => p.id === id)
    if (post) {
        ctx.response.send(post)
    } else {
        ctx.response.send({
            error: 'Post not found'
        }, 404)
    }

    next()
})

app.post('/post', onlyAuthenticatedMiddleware, (ctx, next) => {
    const post = ctx.request.body
    post.id = posts.length === 0 ? 0 : posts[posts.length - 1].id + 1
    posts.push(post)

    ctx.response.send(post)

    next()
})

app.delete('/post/:id', onlyAuthenticatedMiddleware, (ctx, next) => {
    const id = parseInt(ctx.request.params.id, 10)
    const index = posts.findIndex(p => p.id === id)
    
    if (index !== -1) {
        posts.splice(index, 1)
        ctx.response.send({
            message: 'Post deleted',
        })
    } else {
        ctx.response.send({
            error: 'Post not found'
        }, 404)
    }

    next()
})

app.put('/post/:id', onlyAuthenticatedMiddleware, (ctx, next) => {
    const id = parseInt(ctx.request.params.id, 10)
    const index = posts.findIndex(p => p.id === id)
    const post = ctx.request.body

    if (index !== -1) {
        post.id = id
        posts[index] = post
        ctx.response.send(post)
    } else {
        ctx.response.send({
            error: 'Post not found'
        }, 404)
    }

    next()
})

/**
 * ----------- END POSTS -----------
 */

app.use((ctx) => {
    console.log(`${ctx.request.method}: ${ctx.request.url}`)
    if (ctx.request.body != null) {
        console.log(ctx.request.body, '\n')
    } else {
        console.log()
    }
})

app.listen(3000, () => {
    console.log('Server is running on port http://localhost:3000');
})
