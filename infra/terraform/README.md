# Terraform (Unified Cloud Infrastructure)

LocalStack-first AWS infrastructure designed to host **Java, Node.js, and .NET** workloads seamlessly on AWS EKS, RDS PostgreSQL, MSK Kafka, and ECR. Real AWS only on **Day 29**.

```
terraform/
├── modules/
│   ├── vpc/
│   ├── eks/
│   ├── rds/
│   ├── msk/
│   ├── ecr/
│   └── iam/
└── envs/
    ├── localstack/
    └── dev/        # real AWS — destroy when done
```

**Always**: `terraform fmt`, `terraform validate`, `tflint`, `checkov` before `plan`. CI enforces.

**Real-AWS checklist (Day 29)**:
1. `aws sts get-caller-identity` — confirm account.
2. `terraform -chdir=envs/dev plan` — review carefully.
3. `terraform -chdir=envs/dev apply` — go.
4. Run polyglot end-to-end smoke tests and performance benchmarks against the real EKS cluster.
5. `terraform -chdir=envs/dev destroy` — non-negotiable.
