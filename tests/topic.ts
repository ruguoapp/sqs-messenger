import test from './_init'
import * as Promise from 'bluebird'
import * as sinon from 'sinon'
import { SQS, SNS } from 'aws-sdk'

import Topic from '../lib/topic'
import Queue from '../lib/queue'
import * as config from '../lib/config'

const sqs = new SQS({
  region: 'cn-north-1',
  apiVersion: '2012-11-05',
})

const sns = new SNS({
  region: 'cn-north-1',
  apiVersion: '2010-03-31',
})

test.before(() => {
  sinon.stub(config, 'getResourceNamePrefix').returns('test_')
  sinon.stub(config, 'getSqsArnPrefix').returns('arn:sqs:test:')
})

test.cb.serial('should create topic', t => {
  const mock = t.context.sandbox.mock(sns).expects('createTopic').once()
    .withArgs({ Name: 'test_t1' })
    .callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })

  const t1 = new Topic(sns, 't1')
  t1.on('ready', () => {
    mock.verify()
    t.end()
  })
})

test.serial('should bind queue', t => {
  t.context.sandbox.stub(sns, 'createTopic').callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })
  t.context.sandbox.stub(sqs, 'createQueue').callsArgWithAsync(1, null, { QueueUrl: 'http://test/tq1' })

  const subStub = t.context.sandbox.mock(sns).expects('subscribe').once()
    .callsArgWithAsync(1, null, { SubscriptionArn: 'arn:subscription' })
  const setAttrStub = t.context.sandbox.stub(sns, 'setSubscriptionAttributes').callsArgWithAsync(1, null, {})

  const tq = new Queue(sqs, 'tq')
  const t2 = new Topic(sns, 't2')
  t2.subscribe(tq)

  return Promise.delay(200)
    .then(() => {
      t.truthy(subStub.calledOnce)
      t.truthy(setAttrStub.calledOnce)
      t.deepEqual(subStub.firstCall.args[0], {
        Protocol: 'sqs',
        TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1',
        Endpoint: 'arn:sqs:test:test_tq',
      })
      t.deepEqual(setAttrStub.firstCall.args[0], {
        SubscriptionArn: 'arn:subscription',
        AttributeName: 'RawMessageDelivery',
        AttributeValue: 'true',
      })
    })
})