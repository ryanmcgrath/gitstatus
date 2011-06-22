GitStatus - A Simple Repository Feed Widget
====================================================================================================
I was surpised that this didn't already exist, but eh, whatever.

This is a widget that provides a feed of recent commits on a repository
using the Github API. It's completely client-side, so it won't work on
private repositories, but that's a small price to pay.

The one thing to note about this widget is that it technically has to make
two requests to GitHub to get all the information it needs. This is due to
how the GitHub API works; it's less than ideal, but overall not too bad.

Example usage is as follows:

``` html
<div id="gitstatus_16258"></div>
<script type="text/javascript" src=""></script>
<script type="text/javascript">
	new GitStatus({
		id: "gitstatus_16258",
		github_username: "ryanmcgrath",
		github_repository: "pygengo",
		no_of_commits: 5,
		//disable_all_styles: true
	}).show();
</script>
```

Uncommenting the "disable_all_styles" option will do exactly that - no default styling will be applied
and you can then style the widget to your needs from the ground up.


Questions, Comments, Praise, etc?
-------------------------------------------------------------------------------------------------------
This was built in the space of... 2 hours, so it's not perfect. It's totally open source, though, so feel
free to hack/fork/do whatever with it.

I'm available on Twitter as @ryanmcgrath, or via email at ryan [at] venodesigns (.) net. Hit me up!
