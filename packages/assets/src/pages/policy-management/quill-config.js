/** Shared Quill editor configuration for policy editing */

export const QUILL_MODULES = {
  toolbar: [
    [{header: [1, 2, 3, 4, false]}],
    ['bold', 'italic', 'underline', 'strike'],
    [{color: []}, {background: []}],
    [{align: []}],
    [{list: 'ordered'}, {list: 'bullet'}],
    ['link', 'image'],
    ['blockquote', 'code-block'],
    ['clean']
  ]
};

export const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align', 'list',
  'link', 'image', 'blockquote', 'code-block'
];
