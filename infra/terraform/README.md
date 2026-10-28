# Terraform

LocalStack-first AWS infrastructure, shared by every stack: services run on the same EKS, RDS, MSK and ECR whichever language they are written in. Real AWS only on **Day 29**.

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
4. Run end-to-end smoke against the real EKS (for every stack deployed).
5. `terraform -chdir=envs/dev destroy` — non-negotiable.
