/**
 * Markdown Enhanced
 * @author memset0
 * @website https://memset0.cn
 * @description Generate page title.
 * @example
 *     <%- markdown_enhanced(content) %>
 */

const assert = require('assert');

hexo.extend.helper.register("markdown_enhanced", function (source) {
	try {
		let result = source;

		/**
		 * HTML 宏语法
		 * @example definition
		 *     <!--DEFINE :name(:arg1, :arg2) :content-->
		 * @example usage
		 *     <!--:name-->
		 */
		const reg_definition = /<!--DEFINE (?<name>[a-zA-Z0-9-_]+?)(\((?<arguments>[a-zA-Z0-9, -_]+?)\))? (?<content>[\s\S]*?(?=-->))-->/;

		const matched_result = result.match(new RegExp(reg_definition, 'g'));
		const definition_list = !matched_result ?
			[] :
			matched_result.map(definition_string => {
				const { name, content, arguments } = definition_string.match(reg_definition).groups;
				return { name, content, arguments: arguments ? arguments.split(',').map(s => s.trim()) : [] };
			});;

		result = result.replace(new RegExp(reg_definition, 'g'), '');
		for (const definition of definition_list) {
			if (definition.arguments.length) {
				result = result.replace(new RegExp('<!--' + definition.name + '\\((.+)\\)-->', 'g'), (_matched, argument_string) => {
					const argument_list = argument_string.split(/, ?/g);
					let content_parts = definition.content.split('$$');
					for (let i = 0; i < definition.arguments.length; i++) {
						const argv = i < argument_list.length ? argument_list[i] : '';
						content_parts = content_parts.map(p => p.replace(new RegExp('\\$' + definition.arguments[i], 'g'), argv));
					}
					return content_parts.join('$');
				});
			} else {
				result = result.replace(new RegExp('<!--' + definition.name + '-->', 'g'), definition.content);
			}
		}


		/** 
		 * HTML tag 缩写规则
		 * @example class
		 *     .class
		 * @example id
		 *     #id
		 * @example style
		 *     styleName:styleFormat
		 *     styleName:"styleFormat"
		*/
		result = result.replace(/\<(?!\/)(?=[a-zA-Z])(?<content>[^>]+?)\>/g, (match, content, offset, string) => {
			const tagname = content.split(' ')[0];
			const attr_list = [];
			let inside_quotation = false;
			let current_string = '';
			for (let i = tagname.length + 1; i < content.length; i++) {
				if (content[i] == '"') {
					inside_quotation = !inside_quotation;
				}

				if (!inside_quotation && content[i] == ' ') {
					attr_list.push(current_string);
					current_string = '';
					continue;
				}
				current_string += content[i];
			}
			if (current_string) {
				attr_list.push(current_string);
			}

			const id_list = [];
			const class_list = [];
			const style_list = [];
			const parsed_list = [];

			for (const attr of attr_list) {
				if (attr.split('"')[0].indexOf('=') != -1) {
					const attr_name = attr.split('"')[0].split('=')[0];
					const attr_content = attr.slice(attr_name.length + 1);

					if (attr_name == 'id') {
						assert(attr_content.startsWith('"') && attr_content.endsWith('"'));
						id_list.push(...attr_content.slice(1, attr_content.length - 1).split(' '));
					} else if (attr_name == 'class') {
						assert(attr_content.startsWith('"') && attr_content.endsWith('"'));
						class_list.push(...attr_content.slice(1, attr_content.length - 1).split(' '));
					} else if (attr_name == 'style') {
						assert(attr_content.startsWith('"') && attr_content.endsWith('"'));
						style_list.push(...attr_content.slice(1, attr_content.length - 1).split(';'));
					}
				}
			}

			[id_list, class_list, style_list].forEach(list => (list = list.filter(e => !!e)));

			for (const attr of attr_list) {
				if (attr.split('"')[0].indexOf('=') != -1) {
					const attr_name = attr.split('"')[0].split('=')[0];
					const attr_content = attr.slice(attr_name.length + 1);
					if (attr_name != 'id' && attr_name != 'class' && attr_name != 'style') {
						parsed_list.push(attr_name + '=' + attr_content);
					}

				} else if (attr.startsWith('#')) {
					id_list.push(attr.slice(1));

				} else if (attr.startsWith('.')) {
					class_list.push(attr.slice(1));

				} else if (attr.split('"')[0].indexOf(':') != -1) {
					const style_name = attr.split('"')[0].split(':')[0];
					const style_content = attr.slice(style_name.length + 1);
					if (style_content.startsWith('"') || style_content.endsWith('"')) {
						assert(style_content.startsWith('"') && style_content.endsWith('"'));
						style_content = style_content.slice(1, style_content.length - 1);
					}
					style_list.push(style_name + ': ' + style_content);

				}
			}

			if (id_list.length) {
				parsed_list.unshift('id="' + id_list.join(' ') + '"');
			}
			if (class_list.length) {
				parsed_list.unshift('class="' + class_list.join(' ') + '"');
			}
			if (style_list.length) {
				parsed_list.unshift('style="' + style_list.join('; ') + '"');
			}

			parsed_list.unshift(tagname);
			return '<' + parsed_list.join(' ') + '>';
		});


		return '<!-- Parsed by Markdown Enhanced (by memset0) -->\n\n' +
			result;


	} catch (error) {
		// throw error;

		return '\n\n<!--\n\n' +
			'Carshed into an Error when parsing Markdown Enhanced (by memset0).\n\n' +
			'[' + error.name + '] ' + error.message + '\n\n' +
			'-->\n\n\n' +
			source;

	}
});
