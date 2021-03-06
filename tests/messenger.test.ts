import test from './_init'

import Messenger from '../lib/messenger'
import Queue from '../lib/queue'
import Consumer from '../lib/consumer'
import Topic from '../lib/topic'
import Config from '../lib/config'
import { SqsClient } from '../lib/client'

const config = new Config()

const client = new SqsClient({
  sqsOptions: {
    region: 'cn-north-1',
    apiVersion: '2012-11-05',
  },
  snsOptions: {
    region: 'cn-north-1',
    apiVersion: '2010-03-31',
  },
})

test.beforeEach(t => {
  t.context.sandbox.stub(client, 'createQueue').resolves({
    Locator: 'http://test:c',
  })
  t.context.sandbox
    .stub(client, 'deleteMessage')
    // tslint:disable-next-line:no-unused
    .callsFake((params, callback) => callback())
    .resolves()
  t.context.sandbox
    .stub(client, 'createTopic')
    .resolves({ Locator: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })
})

test.serial('create queue', t => {
  const messenger = new Messenger(client, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_',
  })
  const queue = messenger.createQueue('myQueue')
  t.true(queue instanceof Queue)
  t.pass()
})

test.cb.serial('register one consumer', t => {
  t.context.sandbox
    .stub(client, 'receiveMessageBatch')
    .onFirstCall()
    .resolves({
      Messages: [{ Body: '{}' }],
    })

  const messenger = new Messenger(client, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_',
  })

  messenger.createQueue('myQueue')

  // tslint:disable-next-line:no-unused
  const consumer = messenger.on('myQueue', (message, done) => {
    done()
    t.end()
  })

  t.true(consumer instanceof Consumer)
})

test.cb.serial('register two consumers', t => {
  const receiveMessageBatch = t.context.sandbox.stub(client, 'receiveMessageBatch')
  receiveMessageBatch.onFirstCall().resolves({
    Messages: [{ Body: '{"n": 1}' }],
  })
  receiveMessageBatch.onSecondCall().resolves({
    Messages: [{ Body: '{"n": 2}' }],
  })

  const messenger = new Messenger(client, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_',
  })

  messenger.createQueue('myQueue')

  const numbers: any[] = []
  const consumers = messenger.on(
    'myQueue',
    (message, done) => {
      numbers.push(message.n)
      setTimeout(() => {
        done()
        t.deepEqual(numbers, [1, 2])
        if (message.n === 2) {
          t.end()
        }
      }, 200)
    },
    { consumers: 2 },
  ) as Consumer[]

  t.true(consumers.length === 2)
  consumers.forEach(consumer => {
    t.true(consumer instanceof Consumer)
  })
})

test.cb.serial('bind topic', t => {
  const topicSubscribeStub = t.context.sandbox
    .stub(Topic.prototype, 'subscribe')
    .callsFake()
    .resolves()
  const messenger = new Messenger(client, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_',
  })
  const topic = new Topic(client, 'topic', config)
  const quene = messenger.createQueue('myQueue', {
    bindTopic: topic,
  })
  quene.on('ready', () => {
    t.true(topicSubscribeStub.calledOnce)
    t.true(topicSubscribeStub.calledOn(topic))
    t.true(topicSubscribeStub.calledWith(quene))
    t.end()
  })
})

test.cb.serial('bind topics', t => {
  const topicSubscribeStub = t.context.sandbox.stub(Topic.prototype, 'subscribe').callsFake()
  const messenger = new Messenger(client, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_',
  })
  const topic1 = new Topic(client, 'topic1', config)
  const topic2 = new Topic(client, 'topic2', config)
  const topic3 = new Topic(client, 'topic3', config)
  const quene = messenger.createQueue('myQueue', {
    bindTopics: [topic1, topic2, topic3],
  })
  quene.on('ready', () => {
    t.true(topicSubscribeStub.calledThrice)
    t.true(topicSubscribeStub.calledOn(topic1))
    t.true(topicSubscribeStub.calledOn(topic2))
    t.true(topicSubscribeStub.calledOn(topic3))
    t.true(topicSubscribeStub.calledWith(quene))
    t.end()
  })
})

test.cb.serial('send empty queue', t => {
  const messenger = new Messenger(client, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_',
  })
  messenger.sendQueueMessage('foo', {}).catch(err => {
    t.is(err.message, 'Queue[foo] not found')
    t.end()
  })
})
