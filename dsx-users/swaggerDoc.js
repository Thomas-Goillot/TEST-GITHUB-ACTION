/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - uuid
 *       properties:
 *         uuid:
 *           type: string
 *           description: The unique identifier for the user
 *         latitude:
 *           type: number
 *           description: User's latitude
 *         longitude:
 *           type: number
 *           description: User's longitude
 *         userStatus:
 *           type: string
 *           description: User's status
 *         connected:
 *           type: boolean
 *           description: User connection status
 *         isCasting:
 *           type: boolean
 *           description: Indicates if the user is currently casting
 *         castUrl:
 *           type: string
 *           description: URL to access the user's cast stream (if isCasting is true)
 *         isStreaming:
 *           type: boolean
 *           description: Indicates if the user is currently streaming
 *         streamUrl:
 *           type: string
 *           description: URL to access the user's stream (if isStreaming is true)
 *         isSpeaking:
 *           type: boolean
 *           description: Indicates if the user is currently speaking
 */

/**
 * @swagger
 * /users/create:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: The user was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * /users/readall:
 *   get:
 *     summary: Returns the list of all the users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: The list of the users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * /users/read/{uuid}:
 *   get:
 *     summary: Reads a user
 *     tags: [Users]
 *     description: Reads a single user
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: uuid
 *         description: user's id
 *         in: path
 *         required: true
 *         type: integer
 *     responses:
 *       200:
 *         description: Successfully
 */

/**
 * @swagger
 * /users/update:
 *   post:
 *     summary: Update a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: The user was successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * /users/delete/{uuid}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     description: Deletes a single user
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: uuid
 *         description: user's id
 *         in: path
 *         required: true
 *         type: integer
 *     responses:
 *       200:
 *         description: Successfully deleted
 */

/**
 * @swagger
 * /users/deleteall:
 *   delete:
 *     summary: Delete all user data
 *     tags: [Users]
 *     responses:
 *       200:
 *         description:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Some server error
 */