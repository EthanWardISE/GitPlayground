import * as cdk from 'aws-cdk-lib';
import { beforeAll, jest, test } from '@jest/globals';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'node:path';
import { StaticSiteStack } from '../lib/cdk-stack';

let template: Template;

beforeAll(() => {
  // Use a small fixture so synthesis does not depend on a prior app build.
  const originalAsset = deployment.Source.asset;
  const asset = jest.spyOn(deployment.Source, 'asset').mockImplementation(() => originalAsset(path.join(__dirname, 'fixtures')));
  try {
    template = Template.fromStack(new StaticSiteStack(new cdk.App(), 'TestSite'));
  } finally {
    asset.mockRestore();
  }
});

test('creates the site bucket', () => {
  template.resourceCountIs('AWS::S3::Bucket', 1);
});

test('serves index.html through CloudFront with S3 origin access control', () => {
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: 'index.html',
      Origins: Match.arrayWith([Match.objectLike({ OriginAccessControlId: Match.anyValue() })]),
    }),
  });
  template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
    OriginAccessControlConfig: Match.objectLike({ OriginAccessControlOriginType: 's3', SigningBehavior: 'always' }),
  });
});

test('invalidates cached paths when deploying site files', () => {
  template.hasResourceProperties('Custom::CDKBucketDeployment', {
    DestinationBucketName: Match.anyValue(),
    DistributionId: Match.anyValue(),
    DistributionPaths: ['/*'],
  });
});
