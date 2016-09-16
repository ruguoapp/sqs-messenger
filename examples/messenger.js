const AWS = require('aws-sdk')
const SqsMessenger = require('../lib/messenger')

const sqs = new AWS.SQS({
  region: 'cn-north-1',
  sqs: '2012-11-05',
})

const sns = new AWS.SNS({
  region: 'cn-north-1',
  sns: '2010-03-31',
})
const sqsMessenger = new SqsMessenger({ sqs, sns }, {
  snsArnPrefix: 'arn:aws-cn:sns:cn-north-1:123456789012:',
  sqsArnPrefix: 'arn:aws-cn:sqs:cn-north-1:123456789012:',
  queueUrlPrefix: 'http://sqs.cn-north-1.amazonaws.com.cn/123456789012/',
  resourceNamePrefix: 'test_',
})

const myTopic = sqsMessenger.createTopic('myTopic')
const myQueue = sqsMessenger.createQueue('myQueue', myTopic)


// register consumer on queue
sqsMessenger.on('myQueue', (message, done) => {
  // do something
  console.log(message)
  done()
})

// send message to topic
sqsMessenger.sendTopicMessage('myTopic', { text: 'a simple message send to topic' })

// send message to queue
sqsMessenger.sendQueueMessage('myQueue', { text: 'a simple message send directly to queue' })
