<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-sharing"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-sharing' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-sharing-tab"
    >
        <h2>Sharing maps</h2>
        <p class="mb-8">
            Obviously, you can save the map file and send that to someone, who could upload it to
            the site, work on it, save it, and send it back to you.
        </p>
        <p class="mb-8">
            If you have somewhere you can host the json file, you can add a querystring parameter to
            the url for this site, and it will be automatically loaded. Please note that the file
            extension must be .json, as otherwise your browser will refuse to download the file.
        </p>
        <p class="mb-8">
            Furthermore, if you wish to link to different parts of the same map, there are also
            querystring parameters to enable you to set the zoom level and the centre point of the
            map:
        </p>
        <p class="mb-8">
            https://saferstreetmaker.org?map=https://saferstreetmaker.org/Birmingham.json&amp;zoom=14&amp;centre=52.43937399964168,-1.8881893157958987
        </p>
        <p class="mb-8">
            The current values for zoom and the centre point can be found in the settings window.
            Additionally, you can add the hide-toolbar=true parameter to remove the whole toolbar
            from the map.
        </p>
        <p class="mb-8">
            You can see an example of a link
            <a
                target="_blank"
                href="https://saferstreetmaker.org?map=https://saferstreetmaker.org/Birmingham.json&amp;zoom=14&amp;centre=52.43937399964168,-1.8881893157958987&amp;hide-toolbar=true"
                >here</a
            >.
        </p>
        <h2>
            <img
                src="../../../img/share-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Embedding a map in a web page
        </h2>
        <p class="mb-8">
            However, if you wish to embed a map in a web page (such as a blog post), you can create
            your map, open the Settings (by clicking the Cog button in the toolbar), setting the map
            title, whether the map is in read-only mode (so no one can change it), and selecting
            which layers you want visible on the map.
            <a href="test.html" target="_blank">Example</a>
        </p>
        <p class="mb-8">
            With that done, you can click on the Share button in the toolbar. Here, you can enter
            the dimensions of the map, and whether the toolbar is visible, then hit the Create
            button. The HTML needed to embed the map in your web page will be copied to your
            clipboard, so just go to your page and paste the html into the html of your page.
        </p>
        <p class="mb-8">
            If a group is selected when you create the share link, the link also identifies the
            group and includes its active version number. Opening that link shows the selected group
            and version in read-only mode. The group panel is shown when the group has a description
            or the selected version has implementation phases.
        </p>
        <p class="mb-8">Be warned: this can be a very large amount of data!</p>
    </div>
</template>
