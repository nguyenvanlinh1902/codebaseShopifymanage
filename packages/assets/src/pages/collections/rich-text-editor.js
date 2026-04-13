import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import {useEditor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import {TextStyle} from '@tiptap/extension-text-style';
import {Color} from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

const extensions = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  TextAlign.configure({types: ['heading', 'paragraph']}),
  Link.configure({openOnClick: false}),
  Image,
  Placeholder.configure({placeholder: 'Write a description...'})
];

function ToolbarButton({onClick, isActive, title, children}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rte-btn ${isActive ? 'rte-btn--active' : ''}`}
      title={title}
    >
      {children}
    </button>
  );
}

function EditorToolbar({editor}) {
  if (!editor) return null;

  const activeHeading = [1, 2, 3].find(l => editor.isActive('heading', {level: l}));

  return (
    <div className="rte-toolbar">
      <select
        className="rte-select"
        value={activeHeading ?? 'p'}
        onChange={e => {
          const v = e.target.value;
          if (v === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({level: Number(v)}).run();
        }}
      >
        <option value="p">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <span className="rte-divider" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline"
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>

      <span className="rte-divider" />

      <input
        type="color"
        className="rte-color"
        title="Text color"
        onChange={e => editor.chain().focus().setColor(e.target.value).run()}
      />

      <span className="rte-divider" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({textAlign: 'left'})}
        title="Align left"
      >
        &#8676;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({textAlign: 'center'})}
        title="Align center"
      >
        &#8596;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({textAlign: 'right'})}
        title="Align right"
      >
        &#8677;
      </ToolbarButton>

      <span className="rte-divider" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        &bull;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Ordered list"
      >
        1.
      </ToolbarButton>

      <span className="rte-divider" />

      <ToolbarButton
        onClick={() => {
          const url = window.prompt('URL', editor.getAttributes('link').href || '');
          if (url) editor.chain().focus().setLink({href: url}).run();
          else editor.chain().focus().unsetLink().run();
        }}
        isActive={editor.isActive('link')}
        title="Link"
      >
        &#128279;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Image URL');
          if (url) editor.chain().focus().setImage({src: url}).run();
        }}
        isActive={false}
        title="Image"
      >
        &#128444;
      </ToolbarButton>

      <span className="rte-divider" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        &ldquo;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code block"
      >
        {'</>'}
      </ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({value, onChange}) {
  const editor = useEditor({
    extensions,
    content: value || '',
    onUpdate({editor: ed}) {
      const html = ed.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    }
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rte-wrapper">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired
};
