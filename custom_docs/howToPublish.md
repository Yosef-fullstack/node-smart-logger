# Publishing Process
Looking at your GitHub workflow configuration, here's the sequence of actions you need to take:

1. Commit your changes with the commit message above
2. Push to the master branch (this will trigger the build job but not publishing)
3. Create a new GitHub release (this is what triggers the publishing process)

The workflow is configured to publish to npm only when a GitHub release is created. The publishing step includes:
* Setting up Node.js and pnpm
* Building the project
* Publishing to npm with --access=public flag using your NPM_TOKEN

So the complete sequence is:
1. Commit and push your changes to master
2. Create a new GitHub release with tag v1.2.0
3. The GitHub workflow will automatically publish the package to npm with public access

*You don't need to manually publish to npm - the workflow handles that for you when you create a GitHub release.*