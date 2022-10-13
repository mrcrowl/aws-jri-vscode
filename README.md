# Jump Right In: AWS

⚡️ Quickly jump to AWS resources without having to wade through the [AWS Management Console](https://console.aws.amazon.com/). ⚡️

### Assumptions & Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) is installed.
- Named profiles are configured in `~/.aws/config` with keys/secret keys or SSO settings.
- **NOTE**: Works with AWS-SSO (aka [Identity Centre](https://aws.amazon.com/iam/identity-center/)).

📌 Support for alternative authorization methods may be added, depending on demand.

## Commands

### Special Commands

The _Secrets_ & _SSM Parameters_ commands let you create, edit, view and copy key details for your secrets and parameters without leaving VS Code! You can also jump directly to the resource in AWS Management Console.

| Command             | Actions                  |
| ------------------- | ------------------------ |
| AWS: SSM Parameters | Create, Edit, View, Copy |
| AWS: Secrets        | Create, Edit, View, Copy |

### List & Jump Command

The remaining commands list resources in the selected region and profile. Selecting the resource jumps directly to the resource page in the [AWS Management Console](https://console.aws.amazon.com/).

| Command                       |
| ----------------------------- |
| AWS: CloudFormation Stacks    |
| AWS: CloudFront Distributions |
| AWS: CloudWatch Log Groups    |
| AWS: DynamoDB Tables          |
| AWS: EC2 Auto Scaling Groups  |
| AWS: EC2 Instances            |
| AWS: ECS Clusters             |
| AWS: Lambda Functions         |
| AWS: RDS Databases            |
| AWS: Route 53 Hosted Zones    |
| AWS: S3 Buckets               |

### Settings

Resources are read from one region and AWS profile at a time. Switch profile or region using these comamnds:

| Command                |
| ---------------------- |
| AWS: Switch profile... |
| AWS: Switch region...  |

✨ While viewing a list of resources you can type `@name` to quickly switch to a named profile.
