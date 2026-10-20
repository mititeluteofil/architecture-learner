# Kubernetes (Polyglot Deployment)

`kind` multi-node cluster configuration and the parameterized Helm chart for the Loan Servicing platform.

A single chart (`infra/k8s/helm/loan-platform/`) deploys **Java, Node.js, or .NET** application images by selecting stack-specific values files:
- `values.yaml` (default common configuration, probes, ports)
- `values-java.yaml` (JVM virtual threads, heap limits)
- `values-node.yaml` (Node.js cluster workers, memory limits)
- `values-dotnet.yaml` (ASP.NET Core Kestrel threadpool & Native AOT settings)
- `values-localstack.yaml` / `values-aws.yaml` (environment overlays)

Grown by the `infra-scaffolder` agent at **P8**.

```
k8s/
├── kind-cluster.yaml
└── helm/
    └── loan-platform/
        ├── Chart.yaml
        ├── values.yaml
        ├── values-java.yaml
        ├── values-node.yaml
        ├── values-dotnet.yaml
        ├── values-localstack.yaml
        ├── values-aws.yaml
        └── templates/
            ├── deployment.yaml
            ├── service.yaml
            ├── configmap.yaml
            ├── secret.yaml
            └── hpa.yaml
```
