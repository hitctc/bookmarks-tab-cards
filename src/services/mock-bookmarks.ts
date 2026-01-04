export function getMockBookmarksTree(): chrome.bookmarks.BookmarkTreeNode[] {
  return [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          parentId: '0',
          title: '书签栏',
          children: [
            {
              id: '10',
              parentId: '1',
              title: 'Vue 文档',
              url: 'https://cn.vuejs.org/',
            },
            {
              id: '11',
              parentId: '1',
              title: 'Vite',
              url: 'https://vitejs.dev/',
            },
            {
              id: '12',
              parentId: '1',
              title: '工具箱',
              children: [
                {
                  id: '120',
                  parentId: '12',
                  title: 'GitHub',
                  url: 'https://github.com/',
                }
              ],
            },
          ],
        },
        {
          id: '2',
          parentId: '0',
          title: '其他书签',
          children: [
            {
              id: '20',
              parentId: '2',
              title: 'Chrome Extensions 文档',
              url: 'https://developer.chrome.com/docs/extensions/',
            }
          ],
        }
      ],
    },
  ];
}


