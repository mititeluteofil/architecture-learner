# Kubernetes

`kind` cluster config and one parameterised Helm chart for the platform. The chart deploys any stack's image, because every service honours the same contract (see [`../CONTRACT.md`](../CONTRACT.md)).

Common settings (probes, ports, env vars) live in `values.yaml`. Per-stack overlays (`values-<stack>.yaml`) hold runtime-specific resource limits and tuning. `values-localstack.yaml` and `values-aws.yaml` are environment overlays.

Grown by the `infra-scaffolder` agent at **P8**.

```
k8s/
├── kind-cluster.yaml
└── helm/
    └── loan-platform/
        ├── Chart.yaml
        ├── values.yaml
        ├── values-<stack>.yaml     # one per stack in play
        ├── values-localstack.yaml
        ├── values-aws.yaml
        └── templates/
```
