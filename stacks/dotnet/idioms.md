# .NET idioms

- **Layout:** one solution per project dir, one `.csproj` per layer (`Domain`, `Application`, `Adapters.*`, `Host`), tests in `tests/`. Add each project with `dotnet sln add`.
- **Ports:** interfaces in the Application project. Domain references nothing; adapters reference Application.
- **DI:** the built-in container. Registrations live in the Host (composition root) or an adapter's `AddXxx` extension, never in Domain. Constructor injection only.
- **Baseline step (C# 7.3):** `<LangVersion>7.3</LangVersion>`, classes with `readonly` fields and explicit constructors. No records, no `init`, no nullable annotations, no switch expressions.
- **Modern step (C# 12):** records for value objects, `init` members, switch expressions with patterns, nullable reference types enabled.
- **Money:** `decimal` plus explicit `MidpointRounding`; never `double`.
- **Stub idiom:** `throw new NotImplementedException("LEARNER: implement - <hint>");`. Records and classes get members only, with `// LEARNER: invariant - <hint>` where validation belongs.
- **Failing tests:** `Assert.Fail("LEARNER: <hint>");`, one behavior per `[Fact]`, snake_case names.
- **Config:** `appsettings.json` has no comments; put `LEARNER:` hints in the scaffold summary or use empty keys plus a note in the PLAN.
- **Images:** SDK container publish; set `ContainerPort` from `PORT`.

## Do not

- Do not write method bodies, validation or mapping logic.
- Do not reference web-framework or ORM types from Domain.
- Do not add packages the PLAN has not decided on.
- Do not use a service locator.
